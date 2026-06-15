import { Router, Request, Response } from 'express';
import { all, get } from '../../db/index.js';

const router = Router();

router.get('/analytics/overview', (_req: Request, res: Response) => {
  const totalCustomers = get<any>('SELECT COUNT(*) as c FROM customers')?.c || 0;
  const totalRevenue = get<any>('SELECT ROUND(SUM(amount)) as s FROM orders')?.s || 0;
  const avgOrderValue = get<any>('SELECT ROUND(AVG(amount)) as a FROM orders')?.a || 0;
  const activeCampaigns = get<any>("SELECT COUNT(*) as c FROM campaigns WHERE status IN ('active','sending')")?.c || 0;
  const avgEngagement = get<any>('SELECT ROUND(AVG(engagement_score), 1) as a FROM customers')?.a || 0;
  const churnRate = get<any>('SELECT ROUND(AVG(predicted_churn), 2) as a FROM customers')?.a || 0;
  const totalOrders = get<any>('SELECT COUNT(*) as c FROM orders')?.c || 0;
  const repeatCustomers = get<any>('SELECT COUNT(*) as c FROM customers WHERE order_frequency > 1')?.c || 0;

  res.json({
    totalCustomers, totalRevenue, avgOrderValue, activeCampaigns,
    avgEngagement, churnRate, totalOrders,
    repeatRate: Math.round((repeatCustomers / Math.max(totalCustomers, 1)) * 100),
    topChannel: get<any>("SELECT favorite_channel, COUNT(*) as c FROM customers GROUP BY favorite_channel ORDER BY c DESC LIMIT 1")?.favorite_channel || 'whatsapp',
  });
});

router.get('/analytics/revenue', (_req: Request, res: Response) => {
  const timeline = all(`
    SELECT strftime('%Y-%m', timestamp) as month,
      ROUND(SUM(amount)) as revenue, COUNT(*) as orders
    FROM orders GROUP BY month ORDER BY month ASC LIMIT 12
  `);
  res.json(timeline);
});

router.get('/analytics/retention', (_req: Request, res: Response) => {
  const cohorts = all(`
    SELECT
      CASE
        WHEN order_frequency >= 10 THEN '10+'
        WHEN order_frequency >= 5 THEN '5-9'
        WHEN order_frequency >= 3 THEN '3-4'
        WHEN order_frequency >= 2 THEN '2'
        ELSE '1'
      END as cohort,
      COUNT(*) as customers,
      ROUND(AVG(total_spend)) as avgSpend,
      ROUND(AVG(engagement_score), 1) as avgEngagement
    FROM customers GROUP BY cohort ORDER BY avgSpend DESC
  `);
  res.json(cohorts);
});

router.get('/analytics/channels', (_req: Request, res: Response) => {
  const channels = all(`
    SELECT favorite_channel as channel, COUNT(*) as customers,
      ROUND(AVG(engagement_score), 1) as avgEngagement,
      ROUND(SUM(total_spend)) as totalSpend
    FROM customers GROUP BY favorite_channel
  `);
  res.json(channels);
});

router.get('/analytics/geographic', (_req: Request, res: Response) => {
  const geo = all(`
    SELECT location as city, COUNT(*) as customers,
      ROUND(SUM(total_spend)) as totalSpend,
      ROUND(AVG(engagement_score), 1) as avgEngagement
    FROM customers GROUP BY location ORDER BY customers DESC LIMIT 15
  `);
  res.json(geo);
});

router.get('/analytics/funnel', (_req: Request, res: Response) => {
  const total = get<any>('SELECT COUNT(*) as c FROM customers')?.c || 0;
  const engaged = get<any>('SELECT COUNT(*) as c FROM customers WHERE engagement_score > 30')?.c || 0;
  const active = get<any>("SELECT COUNT(*) as c FROM customers WHERE julianday('now') - julianday(last_purchase) <= 30")?.c || 0;
  const repeat = get<any>('SELECT COUNT(*) as c FROM customers WHERE order_frequency > 1')?.c || 0;
  const vip = get<any>("SELECT COUNT(*) as c FROM customers WHERE persona = 'High Lifetime VIP'")?.c || 0;

  res.json([
    { stage: 'Total Customers', count: total, percentage: 100 },
    { stage: 'Engaged', count: engaged, percentage: Math.round((engaged / Math.max(total, 1)) * 100) },
    { stage: 'Active (30d)', count: active, percentage: Math.round((active / Math.max(total, 1)) * 100) },
    { stage: 'Repeat Buyers', count: repeat, percentage: Math.round((repeat / Math.max(total, 1)) * 100) },
    { stage: 'VIP', count: vip, percentage: Math.round((vip / Math.max(total, 1)) * 100) },
  ]);
});

export default router;
