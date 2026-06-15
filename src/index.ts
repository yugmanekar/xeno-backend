import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/index.js';
import { initDatabase, run, get } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { setupSocketIO, emitEvent } from './websocket/index.js';
import { requestLogger, errorHandler, rateLimiter } from './middleware/index.js';

import customerRoutes from './features/customers/routes.js';
import orderRoutes from './features/orders/routes.js';
import segmentRoutes from './features/segments/routes.js';
import campaignRoutes from './features/campaigns/routes.js';
import aiRoutes from './features/ai/routes.js';
import memoryRoutes from './features/memory/routes.js';
import eventRoutes from './features/events/routes.js';
import analyticsRoutes from './features/analytics/routes.js';
import { v4 as uuid } from 'uuid';

async function main() {
  // Initialize database
  await initDatabase();
  await seedDatabase();

  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLogger);
  app.use(rateLimiter(200, 60000));

  // Feature routes
  app.use('/api', customerRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', segmentRoutes);
  app.use('/api', campaignRoutes);
  app.use('/api', aiRoutes);
  app.use('/api', memoryRoutes);
  app.use('/api', eventRoutes);
  app.use('/api', analyticsRoutes);

  // Onboarding setup endpoint
  app.post('/api/onboarding/setup', async (req, res) => {
    const { businessDescription, businessName } = req.body;
    // Data is already seeded, just acknowledge
    run('INSERT INTO events (id, type, title, description, metadata) VALUES (?,?,?,?,?)',
      [uuid(), 'system', 'Workspace configured', `Business: ${businessDescription || businessName || 'Fashion Brand'}. Marketing workspace is ready.`, '{}']);
    res.json({ success: true, message: 'Workspace configured successfully' });
  });

  // Webhook receiver from Channel Service
  app.post('/api/webhooks/delivery-status', (req, res) => {
    const { deliveryId, campaignId, customerId, status, timestamp, channel, metadata } = req.body;

    if (!deliveryId || !status) {
      return res.status(400).json({ error: 'Missing deliveryId or status' });
    }

    try {
      // Update delivery status
      const colMap: Record<string, string> = {
        sent: 'sent_at', delivered: 'delivered_at', read: 'opened_at',
        opened: 'opened_at', clicked: 'clicked_at', converted: 'converted_at', failed: 'failed_at',
      };
      const col = colMap[status];
      if (col) {
        run(`UPDATE deliveries SET status = ?, ${col} = ? WHERE id = ?`, [status, timestamp || new Date().toISOString(), deliveryId]);
      } else {
        run('UPDATE deliveries SET status = ? WHERE id = ?', [status, deliveryId]);
      }

      // Emit WebSocket event
      emitEvent('delivery-update', { deliveryId, campaignId, customerId, status, timestamp: timestamp || new Date().toISOString(), channel });

      // Check if campaign is complete
      if (status === 'converted' || status === 'failed') {
        const remaining = get<any>(
          "SELECT COUNT(*) as c FROM deliveries WHERE campaign_id = ? AND status NOT IN ('converted','failed','clicked')",
          [campaignId]
        );
        if (remaining && remaining.c <= 1) {
          run("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ? AND status = 'active'", [campaignId]);
          emitEvent('campaign-update', { campaignId, status: 'completed' });
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('[WEBHOOK] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use(errorHandler);

  // Setup WebSocket
  setupSocketIO(httpServer);

  // Start server
  httpServer.listen(config.port, () => {
    console.log(`\n🚀 XENO Server running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket ready`);
    console.log(`🤖 AI Mode: ${config.geminiApiKey ? 'Gemini' : 'Mock'}`);
    console.log(`🔗 Channel Service: ${config.channelServiceUrl}\n`);
  });
}

main().catch(console.error);
