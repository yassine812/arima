import dotenv from 'dotenv';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { backup } from 'node:sqlite';
import { Store } from '../backend/database';
import { illustratedProductPhotos } from '../src/illustratedProducts';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });
const database = path.resolve(process.env.DATABASE_PATH || 'data/arima.sqlite');
if (!existsSync(database)) throw new Error('The existing ARIMA database is required.');
const store = new Store(database);
try {
  const products = store.list('products');
  const manifest = JSON.parse(readFileSync('output/illustration-prompts.json', 'utf8'));
  for (const product of products) {
    if (!manifest.some((record: { id: string }) => record.id === product.id)) throw new Error(`Unreviewed illustration: ${product.id}`);
    if (!illustratedProductPhotos[product.id] || !existsSync(`public${illustratedProductPhotos[product.id]}`)) throw new Error(`Missing illustration: ${product.id}`);
  }
  await backup(store.db, path.resolve(`backups/before-illustrated-catalogue-${Date.now()}.sqlite`));
  store.transaction(() => {
    for (const product of products) store.save('products', { ...product, image: illustratedProductPhotos[product.id] });
  });
  writeFileSync('output/product-photo-audit.json', JSON.stringify({
    mode: 'Generated animated-style illustrations requested by the user, inspired by the original product photos.',
    productsReviewed: products.length,
    products: store.list('products').map(product => ({ id: product.id, name: product.name, category: product.category, price: product.price, image: product.image, source: 'Built-in image generation; flavour, toppings and format reviewed.' })),
  }, null, 2));
  console.log(JSON.stringify({ updated: products.length, miniPrices: [...new Set(products.filter(p => p.category === 'Mini tiramisus').map(p => p.price))] }));
} finally { store.close(); }
