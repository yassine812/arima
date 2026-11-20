import dotenv from 'dotenv';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { backup } from 'node:sqlite';
import { Store } from '../backend/database';
import { productPhoto } from '../src/productPhotos';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });
const database = path.resolve(process.env.DATABASE_PATH || 'data/arima.sqlite');
if (!existsSync(database)) throw new Error('The existing ARIMA database is required.');
const store = new Store(database);
try {
  const replacements = store.list('products').filter(product => product.category === 'Mini tiramisus').flatMap(product => {
    const image = productPhoto({ id: product.id });
    if (!image || product.image === image) return [];
    if (!existsSync(path.join('public', image))) throw new Error(`Missing photo: ${image}`);
    return [{ ...product, image }];
  });
  if (replacements.length) {
    mkdirSync('backups', { recursive: true });
    await backup(store.db, path.resolve(`backups/before-mini-photos-${Date.now()}.sqlite`));
    store.transaction(() => { for (const product of replacements) store.save('products', product); });
  }
  console.log(JSON.stringify({ updated: replacements.length, products: replacements.map(product => product.name) }));
} finally { store.close(); }
