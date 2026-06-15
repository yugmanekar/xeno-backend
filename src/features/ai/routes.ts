import { Router, Request, Response } from 'express';
import { all, get } from '../../db/index.js';
import { generateAI, generateAIJSON } from './gemini.js';
import { insightsPrompt, strategyPrompt, opportunityPrompt } from './prompts.js';

const router = Router();

router.post('/ai/insights', async (_req: Request, res: Response) => {
  try {
    const metrics = {
      totalCustomers: get<any>('SELECT COUNT(*) as c FROM customers')?.c || 0,
      totalRevenue: get<any>('SELECT SUM(total_spend) as s FROM customers')?.s || 0,
      avgEngagement: get<any>('SELECT AVG(engagement_score) as a FROM customers')?.a || 0,
      highChurnCount: get<any>('SELECT COUNT(*) as c FROM customers WHERE predicted_churn > 0.6')?.c || 0,
      dormantVIPs: get<any>("SELECT COUNT(*) as c FROM customers WHERE persona = 'High Lifetime VIP' AND julianday('now') - julianday(last_purchase) > 30")?.c || 0,
      recentOrders: get<any>("SELECT COUNT(*) as c FROM orders WHERE julianday('now') - julianday(timestamp) <= 7")?.c || 0,
      activeCampaigns: get<any>("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active'")?.c || 0,
      repeatRate: get<any>("SELECT ROUND(CAST(SUM(CASE WHEN order_frequency > 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100) as r FROM customers")?.r || 0,
    };

    const prompt = insightsPrompt(metrics);
    const insights = await generateAIJSON<any[]>(prompt);
    res.json(insights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/strategy', async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  try {
    const metrics = {
      totalCustomers: get<any>('SELECT COUNT(*) as c FROM customers')?.c,
      totalRevenue: get<any>('SELECT SUM(total_spend) as s FROM customers')?.s,
      avgEngagement: get<any>('SELECT AVG(engagement_score) as a FROM customers')?.a,
      repeatRate: get<any>("SELECT ROUND(CAST(SUM(CASE WHEN order_frequency > 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100) as r FROM customers")?.r,
      topPersonas: all('SELECT persona, COUNT(*) as c FROM customers GROUP BY persona ORDER BY c DESC LIMIT 5'),
      revenueByCategory: all('SELECT category, ROUND(SUM(amount)) as revenue FROM orders GROUP BY category ORDER BY revenue DESC LIMIT 5'),
    };

    const memory = all('SELECT * FROM ai_memory ORDER BY created_at DESC LIMIT 5');
    const prompt = strategyPrompt(metrics, memory, question);
    const result = await generateAIJSON<any>(prompt);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/explain', async (req: Request, res: Response) => {
  const { topic, context } = req.body;
  try {
    const explanation = await generateAI(
      `Explain this AI decision/insight in detail: "${topic}"\n\nContext: ${JSON.stringify(context || {})}\n\nProvide: 1) Why this was flagged 2) Key factors 3) Confidence level 4) Recommended action. Be specific with numbers.`
    );
    res.json({ explanation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/predict', async (req: Request, res: Response) => {
  const { type, customerId } = req.body;
  try {
    if (customerId) {
      const customer = get('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json({
        churn: (customer as any).predicted_churn,
        clv: (customer as any).predicted_clv,
        bestChannel: (customer as any).favorite_channel,
        bestTime: '10:00 AM IST',
        nextPurchase: `${Math.round(Math.random() * 14 + 3)} days`,
        confidence: 0.78,
      });
    } else {
      const avgChurn = get<any>('SELECT AVG(predicted_churn) as a FROM customers')?.a || 0;
      const totalClv = get<any>('SELECT SUM(predicted_clv) as s FROM customers')?.s || 0;
      res.json({
        overallChurnRate: Math.round(avgChurn * 100) / 100,
        totalPredictedCLV: Math.round(totalClv),
        bestChannel: 'whatsapp',
        bestSendTime: '10:00 AM IST',
        expectedMonthlyRevenue: Math.round(totalClv / 12),
        confidence: 0.82,
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/opportunity', async (_req: Request, res: Response) => {
  try {
    const metrics = {
      dormantHighValue: all("SELECT COUNT(*) as c, ROUND(SUM(predicted_clv)) as clv FROM customers WHERE predicted_churn > 0.5 AND predicted_clv > 20000"),
      underservedSegments: all("SELECT persona, COUNT(*) as c, ROUND(AVG(engagement_score)) as eng FROM customers WHERE engagement_score < 40 GROUP BY persona"),
      categoryGrowth: all("SELECT category, COUNT(*) as c, ROUND(SUM(amount)) as revenue FROM orders WHERE julianday('now') - julianday(timestamp) <= 30 GROUP BY category ORDER BY revenue DESC"),
    };
    const prompt = opportunityPrompt(metrics);
    const result = await generateAIJSON<any>(prompt);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/what-if', async (req: Request, res: Response) => {
  const { discount, channel, audienceSize, currentCtr } = req.body;
  const baseCtr = currentCtr || 0.15;
  const discountMultiplier = 1 + (discount || 10) * 0.02;
  const channelMultiplier = channel === 'whatsapp' ? 1.3 : channel === 'sms' ? 1.1 : channel === 'email' ? 0.8 : 1.0;
  const adjustedCtr = Math.min(baseCtr * discountMultiplier * channelMultiplier, 0.6);
  const size = audienceSize || 100;

  res.json({
    predictedCtr: Math.round(adjustedCtr * 1000) / 1000,
    predictedOpens: Math.round(size * 0.67 * channelMultiplier),
    predictedClicks: Math.round(size * adjustedCtr),
    predictedConversions: Math.round(size * adjustedCtr * 0.2),
    predictedRevenue: Math.round(size * adjustedCtr * 0.2 * 2500 * (1 - (discount || 10) / 100)),
    estimatedROI: Math.round(((size * adjustedCtr * 0.2 * 2500 * (1 - (discount || 10) / 100)) / Math.max(size * 0.5, 1) - 1) * 100),
    confidence: 0.72,
  });
});

export default router;
