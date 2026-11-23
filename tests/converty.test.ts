import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store } from '../backend/database';
import { createApp } from '../backend/app';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../backend/postgres';
import { mockConverty, productId, secondId } from './fixtures/converty';

function pgClient(database: Pick<PGlite, 'query' | 'exec'>, root = database as PGlite) {
  const sql: any = async (parts: TemplateStringsArray, ...values: unknown[]) => (await database.query(parts.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), values)).rows;
  sql.unsafe = async (text: string, params: unknown[] = []) => params.length ? (await database.query(text, params)).rows : (await database.exec(text)).at(-1)?.rows || [];
  sql.json = JSON.stringify; sql.end = () => root.close();
  sql.begin = (fn: (sql: any) => unknown) => root.transaction(async transaction => fn(pgClient(transaction, root)));
  return sql;
}
async function setup(t: any, connected = true, postgres = false) {
  const dir = mkdtempSync(join(tmpdir(), 'arima-commerce-'));
  const store = postgres ? new PostgresStore('postgres://test', pgClient(new PGlite())) : new Store(join(dir, 'test.sqlite'), undefined, 'admin', 'test-admin-password');
  if (store instanceof PostgresStore) await store.initialize('admin', 'test-admin-password');
  const vendor = mockConverty();
  const server = createServer().listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  server.on('request', createApp(store, { converty: { encryptionKey: randomBytes(32).toString('base64'), origin: base, fetcher: vendor.fetcher, now: () => vendor.now } }));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.close(); rmSync(dir, { recursive: true, force: true }); });
  const request = async (path: string, body?: any, cookie = '', origin = base) => {
    const response = await fetch(base + path, { redirect: 'manual', method: body ? 'POST' : 'GET', headers: { ...(body && origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json().catch(() => null), cookie: response.headers.get('set-cookie')?.split(';')[0] || '', location: response.headers.get('location') };
  };
  const admin = (await request('/api/auth/login', { username: 'admin', password: 'test-admin-password' })).cookie;
  const configure = () => request('/api/converty/config', { clientId: 'arima-test-client', clientSecret: 'server-only-secret' }, admin);
  const authorize = async () => {
    const start = await request('/api/converty/authorize', {}, admin);
    assert.equal(start.status, 200);
    const state = new URL(start.data.url).searchParams.get('state');
    return { cookie: start.cookie, path: `/api/converty/callback?code=once&state=${state}`, url: new URL(start.data.url) };
  };
  if (connected) { assert.equal((await configure()).status, 200); const flow = await authorize(); assert.equal((await request(flow.path, undefined, flow.cookie)).status, 303); }
  const catalog = await request('/api/boutique/catalog'); const shopper = catalog.cookie;
  const items = [{ productId, quantity: 2 }];
  const customer = { name: 'Test Customer', phone: '22111222', city: 'Tunis', address: 'Test address', note: 'Near the door' };
  const quote = async (selection = items) => { const r = await request('/api/boutique/quote', { items: selection }, shopper); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
  const order = async (q: any, attemptKey = randomUUID(), selection = items, coordinates = customer) => request('/api/boutique/orders', { items: selection, customer: coordinates, quoteId: q.id, attemptKey, total: 0.001 }, shopper);
  return { base, store, vendor, request, admin, configure, authorize, catalog, shopper, items, customer, quote, order };
}

test('Converty: OAuth is admin-only, state-bound, single-use and limited to the ARIMA store', async t => {
  const s = await setup(t, false);
  assert.equal((await s.request('/api/converty/status')).status, 401);
  assert.equal((await s.request('/api/converty/config', { clientId: 'x', clientSecret: 'x'.repeat(10) })).status, 401);
  await s.configure(); const flow = await s.authorize();
  assert.equal(flow.url.origin, 'https://partner.converty.shop');
  assert.equal(flow.url.searchParams.get('scope'), 'read-stores read-products create-orders');
  assert.equal(flow.url.searchParams.get('redirect_uri'), `${s.base}/api/converty/callback`);
  assert.equal((await s.request(flow.path)).status, 400, 'requires nonce cookie');
  s.vendor.store.slug = 'another-store';
  assert.equal((await s.request(flow.path, undefined, flow.cookie)).status, 403);
  assert.equal((await s.request(flow.path, undefined, flow.cookie)).status, 400, 'state cannot be replayed');
  assert.equal((await s.request('/api/converty/status', undefined, s.admin)).data.connected, false);
  s.vendor.store.slug = 'arima'; const retry = await s.authorize();
  const callback = await s.request(retry.path, undefined, retry.cookie);
  assert.equal(callback.status, 303); assert.equal(callback.location, `${s.base}/espace?connexion=converty`);
  const status = (await s.request('/api/converty/status', undefined, s.admin)).data;
  assert.equal(status.connected, true); assert.equal(status.clientSecret, undefined);
  for (const key of ['credentials', 'tokens']) {
    const row = await s.store.db.prepare('SELECT value FROM metadata WHERE key=?').get(`converty:${key}`);
    assert.doesNotMatch(String(row?.value), /server-only-secret|mock-access-token-secret|mock-refresh-token-secret/);
  }
});

test('Converty: catalog is public but allowlisted; prices, quantities and delivery are server verified', async t => {
  const s = await setup(t);
  assert.equal(s.catalog.status, 200); assert.equal(s.catalog.data.products.length, 2);
  assert.match(s.catalog.cookie, /^arima_shop=/);
  assert.equal(s.catalog.data.products[0].cost, undefined);
  assert.equal(s.catalog.data.products[0].deliveryCost, undefined);
  assert.equal(s.catalog.data.products[0].description, 'Crème douce et fraise.');
  const q = await s.quote(); assert.equal(q.subtotal, 17); assert.equal(q.delivery, 8); assert.equal(q.total, 25);
  assert.equal((await s.request('/api/boutique/quote', { items: s.items }, s.shopper, '')).status, 403);
  assert.equal((await s.request('/api/boutique/quote', { items: s.items }, '', s.base)).status, 400);
  assert.equal((await s.request('/api/boutique/quote', { items: [{ productId, quantity: -1 }] }, s.shopper)).status, 400);
  assert.equal((await s.request('/api/boutique/quote', { items: [{ productId, quantity: 21 }] }, s.shopper)).data.code, 'OUT_OF_STOCK');
  s.vendor.products[0].discounts = [{ quantity: 3, price: 7.255 }];
  const discount = await s.quote([{ productId, quantity: 2 }, { productId, quantity: 1 }]);
  assert.equal(discount.items.length, 1); assert.equal(discount.subtotal, 21.765); assert.equal(discount.total, 29.765);
  s.vendor.products[1].deliveryPrice = 9;
  assert.equal((await s.request('/api/boutique/quote', { items: [...s.items, { productId: secondId, quantity: 1 }] }, s.shopper)).data.code, 'DELIVERY_REVIEW');
});

test('Converty: changed prices require a new confirmation and invalid customers never create an order', async t => {
  const s = await setup(t); const q = await s.quote(); s.vendor.products[0].price = 9;
  const changed = await s.order(q); assert.equal(changed.status, 409); assert.equal(changed.data.code, 'PRICE_CHANGED'); assert.equal(changed.data.details.quote.total, 26); assert.equal(s.vendor.creates, 0);
  const updated = changed.data.details.quote;
  assert.equal((await s.order(updated, randomUUID(), s.items, { ...s.customer, phone: '123' })).status, 400);
  assert.equal((await s.order(updated, randomUUID(), s.items, { ...s.customer, city: 'Unknown' })).status, 400);
  assert.equal(s.vendor.creates, 0);
  s.vendor.advance(600001);
  assert.equal((await s.order(updated)).data.code, 'QUOTE_EXPIRED');
});

test('Converty: concurrent submits and retries produce exactly one server-priced vendor order', async t => {
  const s = await setup(t); const q = await s.quote(); const key = randomUUID();
  const results = await Promise.all([s.order(q, key), s.order(q, key)]);
  assert.ok(results.some(r => r.status === 201)); assert.equal(s.vendor.creates, 1);
  const again = await s.order(q, key); assert.equal(again.data.confirmed, true); assert.equal(again.data.receipt.reference, 1082);
  assert.equal(s.vendor.creates, 1); assert.equal(s.vendor.lastOrder.total.totalPrice, 25); assert.equal(s.vendor.lastOrder.cart[0].pricePerUnit, 8.5);
  assert.equal(s.vendor.lastOrder.status, 'pending'); assert.match(s.vendor.lastOrder.note, new RegExp(key));
  const another = (await s.request('/api/boutique/catalog')).cookie;
  assert.equal((await s.request('/api/boutique/order-status', { attemptKey: key }, another)).status, 404);
  assert.equal((await s.request('/api/boutique/orders', { items: s.items, attemptKey: key, quoteId: q.id, customer: s.customer }, another)).status, 409);
});

test('Converty: uncertain acceptance never replays the upstream POST; admin can reconcile after checking', async t => {
  const s = await setup(t); const q = await s.quote(); const key = randomUUID(); s.vendor.mode = 'uncertain';
  assert.equal((await s.order(q, key)).status, 202);
  assert.equal((await s.order(q, key)).status, 202); assert.equal(s.vendor.creates, 1);
  assert.equal((await s.request('/api/boutique/order-status', { attemptKey: key }, s.shopper)).data.pending, true);
  assert.equal((await s.request('/api/converty/reconcile', { attemptKey: key, confirmed: true, reference: 1082 }, s.admin)).status, 409);
  s.vendor.advance(120001);
  assert.equal((await s.request('/api/converty/reconcile', { attemptKey: key, confirmed: true, reference: 1082 }, s.admin)).status, 200);
  assert.equal((await s.order(q, key)).data.receipt.reference, 1082); assert.equal(s.vendor.creates, 1);
});

test('Converty: explicit rejection allows a deliberate new attempt; expired tokens refresh on server', async t => {
  const s = await setup(t); const q = await s.quote(); s.vendor.mode = 'reject'; const key = randomUUID();
  assert.equal((await s.order(q, key)).data.code, 'ORDER_REJECTED'); assert.equal((await s.order(q, key)).data.code, 'ORDER_REJECTED'); assert.equal(s.vendor.creates, 1);
  s.vendor.mode = 'ok'; const next = await s.order(q); assert.equal(next.status, 201); assert.equal(s.vendor.creates, 2);
  s.vendor.advance(1296000000);
  assert.equal((await s.request('/api/boutique/catalog')).status, 200); assert.equal(s.vendor.refreshes, 1);
});

test('Converty: variant prices and stock override the base product; hidden products cannot be ordered', async t => {
  const s = await setup(t);
  s.vendor.products[0].options = [{ name: 'Format', type: 'text', values: [{ id: 'large', value: 'Grand' }, { id: 'small', value: 'Mini' }] }];
  s.vendor.products[0].newVariants = [{ id: 'v-large', selectedValues: ['large'], price: 12.555, stock: { quantity: 2 } }, { id: 'v-small', selectedValues: ['small'], price: 2, stock: { outOfStock: true } }];
  assert.equal((await s.request('/api/boutique/quote', { items: s.items }, s.shopper)).data.code, 'INVALID_VARIANT');
  assert.equal((await s.request('/api/boutique/quote', { items: [{ productId, quantity: 1, variantId: 'v-small' }] }, s.shopper)).data.code, 'OUT_OF_STOCK');
  const selection = [{ productId, quantity: 2, variantId: 'v-large' }]; const q = await s.quote(selection);
  assert.equal(q.subtotal, 25.11); assert.equal(q.items[0].variantLabel, 'Format : Grand');
  const receipt = await s.order(q, randomUUID(), selection); assert.equal(receipt.status, 201);
  assert.equal(s.vendor.lastOrder.cart[0].selectedVariantsId, 'v-large'); assert.equal(s.vendor.lastOrder.cart[0].pricePerUnit, 12.555);
  s.vendor.products[0].status = 'hidden';
  assert.equal((await s.request('/api/boutique/quote', { items: selection }, s.shopper)).data.code, 'PRODUCT_CHANGED');
});

test('Converty: production PostgreSQL persists OAuth and atomically prevents duplicate public orders', async t => {
  const s = await setup(t, true, true); const q = await s.quote(); const key = randomUUID();
  const result = await Promise.all([s.order(q, key), s.order(q, key)]);
  assert.ok(result.some(r => r.status === 201)); assert.equal(s.vendor.creates, 1);
  assert.equal((await s.order(q, key)).data.receipt.reference, 1082);
  assert.equal((await s.request('/api/converty/status', undefined, s.admin)).data.connected, true);
});
