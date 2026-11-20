import dotenv from 'dotenv';
import path from 'node:path';
import { Store } from '../backend/database';
import { PostgresStore } from '../backend/postgres';

dotenv.config({ path: '.env.production.local', quiet: true });
dotenv.config({ path: '.env.local', quiet: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error('Set DATABASE_URL in the ignored .env.production.local file.');
const local = new Store(path.resolve(process.env.DATABASE_PATH || 'data/arima.sqlite'));
const cloud = new PostgresStore(url);
try {
  await cloud.initialize(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
  await cloud.transaction(async () => {
    // This is a one-time import. Never overwrite an existing active cloud site.
    const populated = await Promise.all(['cafes', 'invoices', 'orders'].map(async table =>
      (await cloud.db.prepare(`SELECT count(*)::int AS count FROM ${table}`).get())!.count));
    if (populated.some(count => count > 0)) throw new Error('Cloud database already contains café activity; migration stopped without changes.');
    for (const table of ['products', 'cafes', 'invoices', 'orders', 'notifications'] as const) {
      const records = local.list(table);
      for (const record of records) await cloud.save(table, record);
      console.log(`${table}: ${records.length} records imported`);
    }
    // Password hashes preserve existing credentials; never export sessions or plaintext passwords.
    for (const account of local.db.prepare('SELECT * FROM accounts').all()) {
      await cloud.db.prepare(`INSERT INTO accounts (id,username,password_hash,role) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,role=excluded.role`)
        .run(account.id, account.username, account.password_hash, account.role);
    }
    for (const entry of local.db.prepare("SELECT key,value FROM metadata WHERE key LIKE 'orders:%' OR key LIKE 'invoices:%'").all()) {
      await cloud.db.prepare('INSERT INTO metadata (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(entry.key, entry.value);
    }
  });
  console.log('Private migration complete. Existing account passwords are preserved.');
} finally { local.close(); await cloud.close(); }
