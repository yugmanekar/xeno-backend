import { Router, Request, Response } from 'express';
import { all, run } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

router.get('/memory', (req: Request, res: Response) => {
  const type = req.query.type as string;
  let where = '1=1';
  const params: any[] = [];
  if (type) { where += ' AND type = ?'; params.push(type); }
  const memories = all(`SELECT * FROM ai_memory WHERE ${where} ORDER BY created_at DESC`, params);
  res.json(memories);
});

router.post('/memory', (req: Request, res: Response) => {
  const { type, title, content, confidence, source, impact, tags } = req.body;
  const id = uuid();
  run('INSERT INTO ai_memory (id, type, title, content, confidence, source, impact, tags) VALUES (?,?,?,?,?,?,?,?)',
    [id, type, title, content, confidence || 0.5, source || 'system', impact || 'medium', JSON.stringify(tags || [])]);
  res.status(201).json({ id });
});

router.get('/memory/summary', (_req: Request, res: Response) => {
  const memories = all('SELECT * FROM ai_memory ORDER BY created_at DESC LIMIT 20');
  const summary = {
    totalMemories: memories.length,
    byType: {} as Record<string, number>,
    topLearnings: memories.slice(0, 5).map((m: any) => ({ title: m.title, confidence: m.confidence, impact: m.impact })),
    avgConfidence: memories.reduce((sum: number, m: any) => sum + (m.confidence || 0), 0) / Math.max(memories.length, 1),
  };
  memories.forEach((m: any) => { summary.byType[m.type] = (summary.byType[m.type] || 0) + 1; });
  res.json(summary);
});

export default router;
