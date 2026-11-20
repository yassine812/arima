import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Product, Cafe, Invoice, Order, AppNotification } from '../src/types';

export interface Collections {
  products: Product; cafes: Cafe; invoices: Invoice; orders: Order; notifications: AppNotification;
}
export interface Account { id: string; username: string; password_hash: string; role: 'admin' | 'cafe' }
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password: string, hash: string) {
  const [salt, digest] = hash.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const tables = ['products', 'cafes', 'invoices', 'orders', 'notifications'] as const;

export class Store {
  readonly db: DatabaseSync;
  constructor(filename: string, legacyPath?: string, adminUsername = 'admin', adminPassword?: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','cafe')));
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
    for (const table of tables) this.db.exec(`CREATE TABLE IF NOT EXISTS ${table}
      (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));`);
    this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS invoice_numbers ON invoices(json_extract(data,'$.invoiceNumber'));
      CREATE UNIQUE INDEX IF NOT EXISTS order_numbers ON orders(json_extract(data,'$.orderNumber'));
      CREATE INDEX IF NOT EXISTS invoice_cafes ON invoices(json_extract(data,'$.cafeId'));
      CREATE INDEX IF NOT EXISTS order_cafes ON orders(json_extract(data,'$.cafeId'));
      CREATE INDEX IF NOT EXISTS notification_recipients ON notifications(json_extract(data,'$.recipientId'));`);
    if (!this.db.prepare("SELECT value FROM metadata WHERE key='initialized'").get()) {
      if (!adminPassword || adminPassword.length < 8) throw new Error('Set ADMIN_PASSWORD (at least 8 characters) in .env.local before first launch.');
      const legacy = legacyPath && existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, 'utf8')) : {};
      this.transaction(() => {
        this.createAccount('admin', adminUsername, adminPassword, 'admin');
        for (const table of tables) {
          if (legacy[table] !== undefined && !Array.isArray(legacy[table])) throw new Error(`Invalid legacy ${table} data.`);
          for (const record of legacy[table] || []) {
            const { password, ...safe } = record;
            if (table === 'cafes' && record.username && password) this.createAccount(record.id, record.username, password, 'cafe');
            this.save(table, safe);
          }
        }
        this.db.prepare("INSERT INTO metadata VALUES ('initialized','1')").run();
      });
    }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      if (result instanceof Promise) return result.then(value => {
        this.db.exec('COMMIT'); return value;
      }, error => { this.db.exec('ROLLBACK'); throw error; }) as T;
      this.db.exec('COMMIT'); return result;
    }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  list<K extends keyof Collections>(table: K): Collections[K][] {
    return this.db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all().map(row => JSON.parse(row.data as string));
  }
  get<K extends keyof Collections>(table: K, id: string): Collections[K] | undefined {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    return row ? JSON.parse(row.data as string) : undefined;
  }
  save<K extends keyof Collections>(table: K, record: Collections[K]) {
    this.db.prepare(`INSERT INTO ${table}(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(record.id, JSON.stringify(record));
    return record;
  }
  remove(table: keyof Collections, id: string) { this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); }
  createAccount(id: string, username: string, password: string, role: Account['role']) {
    this.db.prepare('INSERT INTO accounts VALUES (?,?,?,?)').run(id, username, hashPassword(password), role);
  }
  account(username: string) { return this.db.prepare('SELECT * FROM accounts WHERE username=?').get(username) as unknown as Account | undefined; }
  nextNumber(table: 'orders' | 'invoices') {
    const year = new Date().getFullYear();
    const prefix = `${table === 'orders' ? 'CMD' : 'FACT'}-${year}-`;
    const field = table === 'orders' ? 'orderNumber' : 'invoiceNumber';
    const existingMax = this.list(table).reduce((max, row) => {
      const value = (row as any)[field] as string;
      return value.startsWith(prefix) ? Math.max(max, Number(value.slice(prefix.length)) || 0) : max;
    }, 0);
    const key = `${table}:${year}`;
    const previous = this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key);
    const next = Math.max(existingMax, Number(previous?.value || 0)) + 1;
    this.db.prepare('INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(next));
    return prefix + String(next).padStart(4, '0');
  }
  close() { this.db.close(); }
}
