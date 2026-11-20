import type { Request, Response } from 'express';
import { createApp } from '../backend/app.js';
import { PostgresStore } from '../backend/postgres.js';

let application: Promise<ReturnType<typeof createApp>> | undefined;
async function initialize() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('Connect a PostgreSQL database to this Vercel project.');
  const store = new PostgresStore(url);
  try {
    await store.initialize(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
    return createApp(store, { sessionHours: Number(process.env.SESSION_HOURS || 24), secureCookie: true });
  } catch (error) { await store.close(); throw error; }
}

export default async function handler(req: Request, res: Response) {
  try {
    application ??= initialize().catch(error => { application = undefined; throw error; });
    const app = await application;
    return app(req, res);
  } catch (error) {
    console.error('ARIMA storage initialization failed:', error instanceof Error ? error.message : 'Unknown storage error');
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Le service est en cours de configuration. Réessayez dans quelques instants.' });
  }
}
