import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { schema } from './schema.js';

let db: SqlJsDatabase;

export async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();

  const dbPath = path.resolve(config.dbPath);
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('[DB] Loaded existing database from', dbPath);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new in-memory database');
  }

  db.run("PRAGMA journal_mode=WAL;");
  db.run("PRAGMA foreign_keys=ON;");

  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    db.run(stmt + ';');
  }
  console.log('[DB] Schema initialized');

  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function saveDatabase(): void {
  const dbPath = path.resolve(config.dbPath);
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function run(sql: string, params: any[] = []): void {
  const d = getDb();
  d.run(sql, params);
  saveDatabase();
}

export function all<T = any>(sql: string, params: any[] = []): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = all<T>(sql, params);
  return results[0];
}

export function count(table: string): number {
  const result = get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
  return result?.count ?? 0;
}
