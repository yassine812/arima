import postgres from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { hashPassword, type Account, type Collections } from './database';
import products from './seed-products.json';

const tables = ['products', 'cafes', 'invoices', 'orders', 'notifications'] as const;
type Query = (text: string, params?: any[]) => Promise<any[]>;

/** Durable production storage; SQLite remains available for local development. */
export class PostgresStore {
  private sql: ReturnType<typeof postgres>;
  private context = new AsyncLocalStorage<Query>();
  readonly db = {
    prepare: (text: string) => {
      let index = 0;
      const sql = text.replace(/\?/g, () => `$${++index}`);
      return {
        get: async (...params: any[]): Promise<Record<string, any> | undefined> => (await this.query(sql, params))[0],
        run: async (...params: any[]) => { await this.query(sql, params); },
      };
    },
  };

  constructor(url: string, client?: ReturnType<typeof postgres>) {
    this.sql = client || postgres(url, { max: 4, idle_timeout: 20, connect_timeout: 15, prepare: false });
  }
  private query: Query = (text, params = []) => {
    const transaction = this.context.getStore();
    return transaction ? transaction(text, params) : this.sql.unsafe(text, params);
  };

  async initialize(adminUsername?: string, adminPassword?: string) {
    await this.sql.begin(async transaction => {
      // Serialize schema/bootstrap work across simultaneous function cold starts.
      await transaction`SELECT pg_advisory_xact_lock(1095911757)`;
      await transaction.unsafe(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','cafe')));
        CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_ci ON accounts(lower(username));
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
      for (const table of tables) await transaction.unsafe(`CREATE TABLE IF NOT EXISTS ${table}
        (id TEXT PRIMARY KEY, data JSONB NOT NULL, ordinal BIGSERIAL UNIQUE)`);
      await transaction.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS invoice_numbers ON invoices((data->>'invoiceNumber'));
        CREATE UNIQUE INDEX IF NOT EXISTS order_numbers ON orders((data->>'orderNumber'));
        CREATE INDEX IF NOT EXISTS invoice_cafes ON invoices((data->>'cafeId'));
        CREATE INDEX IF NOT EXISTS order_cafes ON orders((data->>'cafeId'));
        CREATE INDEX IF NOT EXISTS notification_recipients ON notifications((data->>'recipientId'));`);
      const initialized = await transaction`SELECT value FROM metadata WHERE key='initialized'`;
      if (!initialized.length) {
        if (!adminPassword || adminPassword.length < 8) throw new Error('Configure ADMIN_PASSWORD in Vercel before first deployment.');
        await transaction`INSERT INTO accounts (id,username,password_hash,role)
          VALUES ('admin',${adminUsername || 'admin'},${hashPassword(adminPassword)},'admin')`;
        for (const product of products) await transaction`INSERT INTO products (id,data) VALUES (${product.id},${transaction.json(product)})`;
        await transaction`INSERT INTO metadata VALUES ('initialized','1')`;
      }
    });
  }
  async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.context.getStore()) return fn();
    return await this.sql.begin(transaction => this.context.run(
      (text, params = []) => transaction.unsafe(text, params), fn,
    )) as T;
  }
  async list<K extends keyof Collections>(table: K): Promise<Collections[K][]> {
    return (await this.query(`SELECT data FROM ${table} ORDER BY ordinal`)).map(row => row.data);
  }
  async get<K extends keyof Collections>(table: K, id: string): Promise<Collections[K] | undefined> {
    return (await this.query(`SELECT data FROM ${table} WHERE id=$1`, [id]))[0]?.data;
  }
  async save<K extends keyof Collections>(table: K, record: Collections[K]): Promise<Collections[K]> {
    await this.query(`INSERT INTO ${table}(id,data) VALUES ($1,$2::jsonb)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data`, [record.id, JSON.stringify(record)]);
    return record;
  }
  async remove(table: keyof Collections, id: string) { await this.query(`DELETE FROM ${table} WHERE id=$1`, [id]); }
  async createAccount(id: string, username: string, password: string, role: Account['role']) {
    await this.query('INSERT INTO accounts VALUES ($1,$2,$3,$4)', [id, username, hashPassword(password), role]);
  }
  async account(username: string): Promise<Account | undefined> {
    return (await this.query('SELECT * FROM accounts WHERE lower(username)=lower($1)', [username]))[0];
  }
  async nextNumber(table: 'orders' | 'invoices') {
    const year = new Date().getFullYear();
    const prefix = `${table === 'orders' ? 'CMD' : 'FACT'}-${year}-`;
    const field = table === 'orders' ? 'orderNumber' : 'invoiceNumber';
    const existingMax = (await this.list(table)).reduce((max, row) => {
      const value = row[field] as string;
      return value.startsWith(prefix) ? Math.max(max, Number(value.slice(prefix.length)) || 0) : max;
    }, 0);
    const [row] = await this.query(`INSERT INTO metadata(key,value) VALUES ($1,$2)
      ON CONFLICT(key) DO UPDATE SET value=(GREATEST(metadata.value::bigint,$3::bigint)+1)::text RETURNING value`,
    [`${table}:${year}`, String(existingMax + 1), existingMax]);
    return prefix + String(row.value).padStart(4, '0');
  }
  async close() { await this.sql.end({ timeout: 5 }); }
}
