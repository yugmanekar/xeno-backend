import { Router, Request, Response } from 'express';
import { all, get, count } from '../../db/index.js';

const router = Router();

router.get('/customers', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const persona = req.query.persona as string;
  const sort = (req.query.sort as string) || 'created_at';
  const order = (req.query.order as string) || 'DESC';

  let where = '1=1';
  const params: any[] = [];

  if (search) {
    where += ` AND (name LIKE ? OR email LIKE ? OR location LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (persona) {
    where += ` AND persona = ?`;
    params.push(persona);
  }

  const validSorts = ['name', 'total_spend', 'engagement_score', 'predicted_churn', 'predicted_clv', 'last_purchase', 'created_at'];
  const safeSort = validSorts.includes(sort) ? sort : 'created_at';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const total = get<{ c: number }>(`SELECT COUNT(*) as c FROM customers WHERE ${where}`, params)?.c || 0;
  const customers = all(`SELECT * FROM customers WHERE ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`, [...params, limit, offset]);

  res.json({ customers, total, page, limit, totalPages: Math.ceil(total / limit) });
});

router.get('/customers/stats', (_req: Request, res: Response) => {
  const totalCustomers = get<{ c: number }>('SELECT COUNT(*) as c FROM customers')?.c || 0;
  const totalRevenue = get<{ s: number }>('SELECT SUM(total_spend) as s FROM customers')?.s || 0;
  const avgOrderValue = get<{ a: number }>('SELECT AVG(avg_order) as a FROM customers')?.a || 0;
  const avgEngagement = get<{ a: number }>('SELECT AVG(engagement_score) as a FROM customers')?.a || 0;
  const avgChurn = get<{ a: number }>('SELECT AVG(predicted_churn) as a FROM customers')?.a || 0;
  const highRiskCount = get<{ c: number }>('SELECT COUNT(*) as c FROM customers WHERE predicted_churn > 0.6')?.c || 0;
  const vipCount = get<{ c: number }>("SELECT COUNT(*) as c FROM customers WHERE persona = 'High Lifetime VIP'")?.c || 0;
  const activeLast30 = get<{ c: number }>("SELECT COUNT(*) as c FROM customers WHERE julianday('now') - julianday(last_purchase) <= 30")?.c || 0;

  res.json({
    totalCustomers, totalRevenue: Math.round(totalRevenue),
    avgOrderValue: Math.round(avgOrderValue), avgEngagement: Math.round(avgEngagement * 10) / 10,
    churnRate: Math.round(avgChurn * 100) / 100, highRiskCount, vipCount, activeLast30,
    repeatRate: Math.round((activeLast30 / Math.max(totalCustomers, 1)) * 100),
    topChannel: get<{ favorite_channel: string }>("SELECT favorite_channel, COUNT(*) as c FROM customers GROUP BY favorite_channel ORDER BY c DESC LIMIT 1")?.favorite_channel || 'whatsapp',
  });
});

router.get('/customers/personas', (_req: Request, res: Response) => {
  const personas = all(`
    SELECT persona, COUNT(*) as count,
      ROUND(AVG(total_spend)) as avgSpend,
      ROUND(AVG(engagement_score), 1) as avgEngagement,
      ROUND(AVG(predicted_churn), 2) as avgChurn,
      ROUND(AVG(predicted_clv)) as avgClv
    FROM customers GROUP BY persona ORDER BY count DESC
  `);
  res.json(personas);
});

router.get('/customers/:id', (req: Request, res: Response) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const orders = all('SELECT * FROM orders WHERE customer_id = ? ORDER BY timestamp DESC', [req.params.id]);
  const deliveries = all('SELECT * FROM deliveries WHERE customer_id = ? ORDER BY sent_at DESC LIMIT 20', [req.params.id]);

  res.json({ customer, orders, deliveries });
});

router.post('/customers', (req: Request, res: Response) => {
  const { name, email, phone, location, gender, age, preferences } = req.body;
  const { v4: uuid } = require('uuid');
  const id = uuid();
  try {
    const { run } = require('../../db/index.js');
    run(
      'INSERT INTO customers (id, name, email, phone, location, gender, age, preferences) VALUES (?,?,?,?,?,?,?,?)',
      [id, name, email, phone, location, gender, age, JSON.stringify(preferences || [])]
    );
    res.status(201).json({ id, message: 'Customer created' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
