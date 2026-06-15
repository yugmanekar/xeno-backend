import { Router, Request, Response } from 'express';
import { all, run } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/events', (req: Request, res: Response) => {
  const type = req.query.type as string;
  const limit = parseInt(req.query.limit as string) || 50;
  let where = '1=1';
  const params: any[] = [];
  if (type) { where += ' AND type = ?'; params.push(type); }
  const events = all(`SELECT * FROM events WHERE ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);
  res.json(events);
});

router.post('/events', (req: Request, res: Response) => {
  const { type, title, description, metadata } = req.body;
  const id = uuid();
  run('INSERT INTO events (id, type, title, description, metadata) VALUES (?,?,?,?,?)',
    [id, type, title, description, JSON.stringify(metadata || {})]);
  res.status(201).json({ id });
});

export default router;
