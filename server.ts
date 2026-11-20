import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { Store } from './backend/database';
import { createApp } from './backend/app';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

async function main() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const store = new Store(
    path.resolve(process.env.DATABASE_PATH || 'data/arima.sqlite'),
    path.resolve(process.env.LEGACY_DATA_PATH || 'data-arima-db.json'),
    process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD,
  );
  const app = createApp(store, {
    sessionHours: Number(process.env.SESSION_HOURS || 24),
    secureCookie: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
  });
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve('dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`ARIMA is ready at http://localhost:${port} (SQLite backend)`);
  });
  server.on('error', error => { console.error(error); store.close(); process.exit(1); });
  const shutdown = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
