export const schema = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  gender TEXT,
  age INTEGER,
  preferences TEXT,
  total_spend REAL DEFAULT 0,
  avg_order REAL DEFAULT 0,
  order_frequency INTEGER DEFAULT 0,
  last_purchase TEXT,
  engagement_score REAL DEFAULT 0,
  predicted_churn REAL DEFAULT 0,
  predicted_clv REAL DEFAULT 0,
  favorite_channel TEXT,
  favorite_category TEXT,
  persona TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  discount REAL DEFAULT 0,
  payment_method TEXT,
  location TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment_query TEXT,
  segment_logic TEXT,
  audience_size INTEGER DEFAULT 0,
  channel TEXT,
  tone TEXT,
  message TEXT,
  variants TEXT,
  status TEXT DEFAULT 'draft',
  ai_reasoning TEXT,
  predicted_ctr REAL DEFAULT 0,
  predicted_revenue REAL DEFAULT 0,
  actual_ctr REAL DEFAULT 0,
  actual_revenue REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'queued',
  message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  converted_at TEXT,
  failed_at TEXT,
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS ai_memory (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  confidence REAL DEFAULT 0,
  source TEXT,
  impact TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  natural_query TEXT,
  parsed_logic TEXT,
  customer_count INTEGER DEFAULT 0,
  ai_reasoning TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;
