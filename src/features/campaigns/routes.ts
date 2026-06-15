import { Router, Request, Response } from 'express';
import { all, get, run } from '../../db/index.js';
import { generateAI, generateAIJSON } from '../ai/gemini.js';
import { copywriterPrompt, campaignAnalysisPrompt } from '../ai/prompts.js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config/index.js';
import { getSocketIO } from '../../websocket/index.js';

const router = Router();

router.get('/campaigns', (_req: Request, res: Response) => {
  const campaigns = all('SELECT * FROM campaigns ORDER BY created_at DESC');
  const enriched = campaigns.map((c: any) => {
    const stats = get<any>(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='delivered' OR status='read' OR status='opened' OR status='clicked' OR status='converted' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status='opened' OR status='clicked' OR status='converted' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status='clicked' OR status='converted' THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
      FROM deliveries WHERE campaign_id = ?
    `, [c.id]);
    return { ...c, deliveryStats: stats || { total: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, failed: 0 } };
  });
  res.json(enriched);
});

router.get('/campaigns/:id', (req: Request, res: Response) => {
  const campaign = get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const deliveries = all('SELECT d.*, c.name as customer_name FROM deliveries d LEFT JOIN customers c ON d.customer_id = c.id WHERE d.campaign_id = ? ORDER BY d.sent_at DESC', [req.params.id]);
  const stats = get<any>(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status IN ('delivered','read','opened','clicked','converted') THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status IN ('opened','clicked','converted') THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN status IN ('clicked','converted') THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM deliveries WHERE campaign_id = ?
  `, [req.params.id]);

  res.json({ campaign, deliveries, stats });
});

router.post('/campaigns', async (req: Request, res: Response) => {
  const { name, segmentQuery, segmentLogic, audienceSize, channel, tone, message } = req.body;
  const id = uuid();

  try {
    // Generate AI copy variants
    const copyResult = await generateAIJSON<any>(copywriterPrompt(
      { audienceDescription: segmentQuery, offer: '20% discount', goal: 'Drive purchases' },
      tone || 'friendly', channel || 'whatsapp'
    ));

    const predictedCtr = copyResult.variants?.[0]?.predictedCtr || 0.15;
    const predictedRevenue = Math.round(audienceSize * predictedCtr * 2500);

    run(
      `INSERT INTO campaigns (id, name, segment_query, segment_logic, audience_size, channel, tone, message, variants, status, ai_reasoning, predicted_ctr, predicted_revenue) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, name, segmentQuery, segmentLogic || '', audienceSize || 0, channel || 'whatsapp', tone || 'friendly',
       message || copyResult.variants?.[0]?.message || '', JSON.stringify(copyResult.variants || []),
       'draft', copyResult.reasoning || '', predictedCtr, predictedRevenue]
    );

    run('INSERT INTO events (id, type, title, description, metadata) VALUES (?,?,?,?,?)',
      [uuid(), 'campaign', `Campaign created: ${name}`, `New ${channel} campaign targeting ${audienceSize} customers`, JSON.stringify({ campaignId: id })]);

    res.status(201).json({ id, variants: copyResult.variants, reasoning: copyResult.reasoning, predictedCtr, predictedRevenue });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/launch', async (req: Request, res: Response) => {
  const campaign = get<any>('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Get target customers
  let customers: any[];
  if (campaign.segment_logic) {
    try {
      customers = all(`SELECT id, name, email, phone FROM customers WHERE ${campaign.segment_logic} LIMIT 500`);
    } catch {
      customers = all('SELECT id, name, email, phone FROM customers LIMIT 100');
    }
  } else {
    customers = all('SELECT id, name, email, phone FROM customers LIMIT 100');
  }

  // Create deliveries
  const deliveries = customers.map(c => {
    const deliveryId = uuid();
    run(
      'INSERT INTO deliveries (id, campaign_id, customer_id, channel, status, message) VALUES (?,?,?,?,?,?)',
      [deliveryId, campaign.id, c.id, campaign.channel, 'queued', campaign.message?.replace('{name}', c.name) || campaign.message]
    );
    return { deliveryId, campaignId: campaign.id, customerId: c.id, channel: campaign.channel, message: campaign.message?.replace('{name}', c.name) };
  });

  // Update campaign status
  run('UPDATE campaigns SET status = ?, audience_size = ? WHERE id = ?', ['active', customers.length, campaign.id]);

  // Send to channel service
  try {
    const resp = await fetch(`${config.channelServiceUrl}/api/send-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveries),
    });
    if (!resp.ok) console.error('[CAMPAIGN] Channel service error:', resp.status);
  } catch (err) {
    console.error('[CAMPAIGN] Channel service unreachable, simulating locally');
    // Simulate locally if channel service is down
    simulateDeliveriesLocally(deliveries);
  }

  run('INSERT INTO events (id, type, title, description, metadata) VALUES (?,?,?,?,?)',
    [uuid(), 'campaign', `Campaign launched: ${campaign.name}`, `Sending to ${customers.length} customers via ${campaign.channel}`, JSON.stringify({ campaignId: campaign.id })]);

  const io = getSocketIO();
  if (io) io.emit('campaign-update', { campaignId: campaign.id, status: 'active', audienceSize: customers.length });

  res.json({ message: 'Campaign launched', deliveryCount: deliveries.length });
});

router.post('/campaigns/:id/simulate', async (req: Request, res: Response) => {
  const campaign = get<any>('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const audienceSize = campaign.audience_size || 100;
  const ctr = campaign.predicted_ctr || 0.15;
  const simulation = {
    audienceSize,
    expectedDelivered: Math.round(audienceSize * 0.92),
    expectedOpened: Math.round(audienceSize * 0.92 * 0.67),
    expectedClicked: Math.round(audienceSize * ctr),
    expectedConverted: Math.round(audienceSize * ctr * 0.2),
    expectedRevenue: Math.round(audienceSize * ctr * 0.2 * 2500),
    estimatedCost: Math.round(audienceSize * (campaign.channel === 'sms' ? 0.25 : campaign.channel === 'whatsapp' ? 0.5 : 0.1)),
    estimatedROI: Math.round(((audienceSize * ctr * 0.2 * 2500) / Math.max(audienceSize * 0.5, 1) - 1) * 100),
  };

  res.json(simulation);
});

router.post('/campaigns/generate-copy', async (req: Request, res: Response) => {
  const { audience, tone, channel, offer, goal } = req.body;
  try {
    const result = await generateAIJSON<any>(copywriterPrompt(
      { audienceDescription: audience, offer: offer || '20% discount', goal: goal || 'Drive purchases' },
      tone || 'friendly', channel || 'whatsapp'
    ));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function simulateDeliveriesLocally(deliveries: any[]) {
  const io = getSocketIO();
  const statuses = ['sending', 'sent', 'delivered', 'read', 'clicked', 'converted'];
  const dropRates: Record<string, number> = { delivered: 0.92, read: 0.7, clicked: 0.3, converted: 0.2 };

  deliveries.forEach((d, i) => {
    let delay = 100;
    let prevPassed = true;
    for (const status of statuses) {
      if (!prevPassed) break;
      if (Math.random() > 0.08 || status === 'sending') {
        const roll = dropRates[status];
        if (roll && Math.random() > roll) { prevPassed = false; continue; }

        delay += Math.random() * 800 + 200;
        const currentStatus = status;
        const currentDelay = delay;
        setTimeout(() => {
          const col = currentStatus === 'sending' ? 'sent_at' :
                      currentStatus === 'sent' ? 'sent_at' :
                      `${currentStatus}_at`;
          try {
            run(`UPDATE deliveries SET status = ?, ${col} = datetime('now') WHERE id = ?`, [currentStatus, d.deliveryId]);
            if (io) io.emit('delivery-update', { deliveryId: d.deliveryId, campaignId: d.campaignId, customerId: d.customerId, status: currentStatus, timestamp: new Date().toISOString(), channel: d.channel });
          } catch (e) { /* ignore */ }
        }, currentDelay + i * 50);
      } else {
        setTimeout(() => {
          try {
            run("UPDATE deliveries SET status = 'failed', failed_at = datetime('now') WHERE id = ?", [d.deliveryId]);
            if (io) io.emit('delivery-update', { deliveryId: d.deliveryId, campaignId: d.campaignId, status: 'failed', timestamp: new Date().toISOString(), channel: d.channel });
          } catch (e) { /* ignore */ }
        }, delay);
        break;
      }
    }
  });
}

export default router;
