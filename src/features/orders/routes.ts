import { Router, Request, Response } from 'express';
import { all, get } from '../../db/index.js';

const router = Router();

router.get('/orders', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const customerId = req.query.customer_id as string;

  let where = '1=1';
  const params: any[] = [];
  if (customerId) { where += ' AND customer_id = ?'; params.push(customerId); }

  const total = get<{ c: number }>(`SELECT COUNT(*) as c FROM orders WHERE ${where}`, params)?.c || 0;
  const orders = all(`SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE ${where.replace('customer_id', 'o.customer_id')} ORDER BY o.timestamp DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

  res.json({ orders, total, page, limit });
});

router.get('/orders/stats', (_req: Request, res: Response) => {
  const totalOrders = get<{ c: number }>('SELECT COUNT(*) as c FROM orders')?.c || 0;
  const totalRevenue = get<{ s: number }>('SELECT SUM(amount) as s FROM orders')?.s || 0;
  const avgOrder = get<{ a: number }>('SELECT AVG(amount) as a FROM orders')?.a || 0;
  const avgDiscount = get<{ a: number }>('SELECT AVG(discount) as a FROM orders WHERE discount > 0')?.a || 0;
  res.json({ totalOrders, totalRevenue: Math.round(totalRevenue), avgOrder: Math.round(avgOrder), avgDiscount: Math.round(avgDiscount * 10) / 10 });
});

router.get('/orders/timeline', (_req: Request, res: Response) => {
  const timeline = all(`
    SELECT strftime('%Y-%m', timestamp) as month,
      COUNT(*) as orders, ROUND(SUM(amount)) as revenue, ROUND(AVG(amount)) as avgOrder
    FROM orders GROUP BY month ORDER BY month DESC LIMIT 12
  `);
  res.json(timeline.reverse());
});

router.get('/orders/categories', (_req: Request, res: Response) => {
  const categories = all(`
    SELECT category, COUNT(*) as orders, ROUND(SUM(amount)) as revenue,
      ROUND(AVG(amount)) as avgOrder
    FROM orders GROUP BY category ORDER BY revenue DESC
  `);
  res.json(categories);
});

export default router;
