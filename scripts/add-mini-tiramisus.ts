import dotenv from 'dotenv';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { backup } from 'node:sqlite';
import { Store } from '../backend/database';
import { productPhoto } from '../src/productPhotos';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });
const database = path.resolve(process.env.DATABASE_PATH || 'data/arima.sqlite');
if (!existsSync(database)) throw new Error('Launch ARIMA once before adding the mini range.');
const store = new Store(database);
try {
  const products = store.list('products');
  const regular = products.filter(product => product.category === 'Tiramisus');
  if (!regular.length) throw new Error('No regular tiramisu flavours found.');
  // The user confirmed every existing flavour at 2.000 DT per mini.
  const additions = regular.map(product => ({
    id: `mini_${product.id}`,
    name: `Mini ${product.name}`,
    price: 2,
    category: 'Mini tiramisus',
    description: `Format mini à l’unité. ${product.description}`,
    image: productPhoto({ id: `mini_${product.id}` }) || 'photo_pending',
  })).filter(product => !products.some(existing => existing.id === product.id || existing.name.toLocaleLowerCase('fr') === product.name.toLocaleLowerCase('fr')));
  if (additions.length) {
    mkdirSync('backups', { recursive: true });
    await backup(store.db, path.resolve(`backups/before-mini-tiramisus-${Date.now()}.sqlite`));
    store.transaction(() => { for (const product of additions) store.save('products', product); });
  }
  console.log(JSON.stringify({ added: additions.length, miniProducts: store.list('products').filter(p => p.category === 'Mini tiramisus').length, unitPriceDT: 2 }));
} finally { store.close(); }
