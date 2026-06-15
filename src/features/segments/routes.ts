import { Router, Request, Response } from 'express';
import { all, get, run } from '../../db/index.js';
import { generateAI, generateAIJSON } from '../ai/gemini.js';
import { segmentationPrompt } from '../ai/prompts.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const SCHEMA_INFO = `columns: name(TEXT), email(TEXT), phone(TEXT), location(TEXT), gender(TEXT), age(INTEGER), total_spend(REAL), avg_order(REAL), order_frequency(INTEGER), last_purchase(TEXT/date), engagement_score(REAL 0-100), predicted_churn(REAL 0-1), predicted_clv(REAL), favorite_channel(TEXT), favorite_category(TEXT), persona(TEXT)`;

router.post('/segments/parse', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const prompt = segmentationPrompt(query, SCHEMA_INFO);
    const result = await generateAIJSON<any>(prompt);

    // Try to execute the SQL to get actual count
    let actualSize = result.estimatedSize || 0;
    try {
      if (result.sql) {
        const countResult = get<{ c: number }>(`SELECT COUNT(*) as c FROM customers WHERE ${result.sql}`);
        actualSize = countResult?.c || 0;
      }
    } catch (sqlErr) {
      console.log('[SEGMENT] SQL execution failed, using estimate:', sqlErr);
    }

    res.json({
      reasoning: result.reasoning,
      logic: result.logic,
      sql: result.sql,
      estimatedSize: actualSize,
      expectedConversion: result.expectedConversion || 0.1,
      risk: result.risk || 'medium',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/segments/execute', async (req: Request, res: Response) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL condition is required' });

  try {
    const customers = all(`SELECT id, name, email, persona, engagement_score, predicted_churn, total_spend, last_purchase FROM customers WHERE ${sql} LIMIT 200`);
    res.json({ customers, count: customers.length });
  } catch (err: any) {
    res.status(400).json({ error: `Invalid segment query: ${err.message}` });
  }
});

router.get('/segments', (_req: Request, res: Response) => {
  const segments = all('SELECT * FROM segments ORDER BY created_at DESC');
  res.json(segments);
});

router.post('/segments', (req: Request, res: Response) => {
  const { name, natural_query, parsed_logic, customer_count, ai_reasoning } = req.body;
  const id = uuid();
  run(
    'INSERT INTO segments (id, name, natural_query, parsed_logic, customer_count, ai_reasoning) VALUES (?,?,?,?,?,?)',
    [id, name, natural_query, JSON.stringify(parsed_logic), customer_count, ai_reasoning]
  );
  res.status(201).json({ id, message: 'Segment saved' });
});

export default router;
