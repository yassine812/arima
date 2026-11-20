import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { Store, tokenHash } from '../backend/database';
import { createApp } from '../backend/app';

const adminPassword = 'admin-test-password';
const seed = {
  products: [{ id: 'prod_custom', name: 'Pistache', price: 3.5, category: 'Pâtisserie', image: '', description: '' }],
  cafes: [
    { id: 'cafe_a', name: 'Café A', username: 'cafe_a', password: 'cafe-a-password', prices: { prod_custom: 2.555 } },
    { id: 'cafe_b', name: 'Café B', username: 'cafe_b', password: 'cafe-b-password', prices: { prod_custom: 0 } },
  ], invoices: [], orders: [], notifications: [],
};
async function setup(t: any) {
  const dir = mkdtempSync(join(tmpdir(), 'arima-backend-'));
  const legacy = join(dir, 'legacy.json');
  const db = join(dir, 'arima.sqlite');
  writeFileSync(legacy, JSON.stringify(seed));
  let store = new Store(db, legacy, 'admin', adminPassword);
  let server: Server;
  let url: string;
  const start = async () => {
    server = await new Promise<Server>(resolve => {
      const instance = createApp(store).listen(0, '127.0.0.1', () => resolve(instance));
    });
    url = `http://127.0.0.1:${(server.address() as any).port}`;
  };
  await start();
  const stop = async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); };
  t.after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
  const request = async (path: string, options: { method?: string; body?: any; cookie?: string; origin?: string } = {}) => {
    const response = await fetch(url + path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.origin ? { Origin: options.origin } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json();
    return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  };
  const login = async (username = 'admin', password = adminPassword) => {
    const response = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    assert.equal(response.status, 200);
    assert.ok(response.cookie);
    return response.cookie!;
  };
  return { request, login, get store() { return store; }, legacy, async restart() { await stop(); store = new Store(db, legacy); await start(); } };
}

test('all private resources require a real session; login, expiry, logout and origin protection', async t => {
  const app = await setup(t);
  for (const route of ['products', 'cafes', 'invoices', 'orders', 'notifications', 'dashboard', 'auth/me']) {
    assert.equal((await app.request('/api/' + route)).status, 401, route);
  }
  assert.equal((await app.request('/api/health')).data.database, 'sqlite');
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } })).status, 401);
  const response = await app.request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: adminPassword } });
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(response.headers.get('set-cookie')!, /SameSite=Strict/);
  const cookie = response.cookie!;
  assert.equal((await app.request('/api/auth/me', { cookie })).data.user.id, 'admin');
  const digest = (app.store.db.prepare('SELECT token_hash FROM sessions').get() as any).token_hash;
  assert.notEqual(digest, cookie.split('=')[1]);
  assert.equal(digest, tokenHash(cookie.split('=')[1]));
  assert.equal((await app.request('/api/products', { cookie: 'arima_session=' + 'a'.repeat(64) })).status, 401);
  assert.equal((await app.request('/api/auth/logout', { method: 'POST', cookie, origin: 'https://evil.example' })).status, 403);
  assert.equal((await app.request('/api/auth/logout', { method: 'POST', cookie })).status, 200);
  assert.equal((await app.request('/api/auth/me', { cookie })).status, 401);
  const expiring = await app.login();
  app.store.db.prepare('UPDATE sessions SET expires_at=0').run();
  assert.equal((await app.request('/api/auth/me', { cookie: expiring })).status, 401);
});

test('login tabs route valid accounts to their real role without granting privileges', async t => {
  const app = await setup(t);
  for (const body of [
    { username: 'admin', password: adminPassword, portal: 'cafe' },
    { username: 'cafe_a', password: 'cafe-a-password', portal: 'admin' },
  ]) {
    const result = await app.request('/api/auth/login', { method: 'POST', body: { ...body, role: body.portal } });
    assert.equal(result.status, 200);
    assert.ok(result.cookie);
    const actualRole = body.username === 'admin' ? 'admin' : 'cafe';
    assert.equal(result.data.user.role, actualRole);
    assert.equal((await app.request('/api/auth/me', { cookie: result.cookie })).data.user.role, actualRole);
    if (actualRole === 'cafe') {
      assert.equal((await app.request('/api/products', { method: 'POST', cookie: result.cookie, body: { name: 'Forged admin action' } })).status, 403);
    }
  }
  for (const portal of ['admin', 'cafe']) {
    const denied = await app.request('/api/auth/login', { method: 'POST', body: { username: 'cafe_a', password: 'wrong-password', portal } });
    assert.equal(denied.status, 401);
    assert.equal(denied.cookie, undefined);
  }
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { username: 'cafe_a', password: 'cafe-a-password', portal: 'owner' } })).status, 400);
  for (const body of [
    { username: 'admin', password: adminPassword, portal: 'admin' },
    { username: 'cafe_a', password: 'cafe-a-password', portal: 'cafe' },
  ]) {
    const result = await app.request('/api/auth/login', { method: 'POST', body });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.role, body.portal);
    assert.equal((await app.request('/api/auth/me', { cookie: result.cookie })).data.user.role, body.portal);
  }
});

test('café products use only their own tariffs and orders remain private and server-priced', async t => {
  const app = await setup(t);
  const admin = await app.login();
  const cafeA = await app.login('cafe_a', 'cafe-a-password');
  const cafeB = await app.login('cafe_b', 'cafe-b-password');
  for (const [cookie, price] of [[admin, 3.5], [cafeA, 2.555], [cafeB, 0]] as const) {
    const result = await app.request('/api/products', { cookie });
    assert.equal(result.status, 200);
    assert.equal(result.data[0].price, price);
    assert.equal(result.data[0].name, 'Pistache');
    assert.equal(result.data[0].prices, undefined);
  }
  assert.equal(app.store.get('products', 'prod_custom')!.price, 3.5, 'reading tariffs never changes the base price');
  for (const cookie of [cafeA, cafeB]) {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const path = method === 'POST' ? '/api/products' : '/api/products/prod_custom';
      assert.equal((await app.request(path, { cookie, method, body: { price: 0 } })).status, 403);
    }
    assert.equal((await app.request('/api/cafes', { cookie, method: 'POST', body: { role: 'admin' } })).status, 403);
  }
  const order = await app.request('/api/orders', { method: 'POST', cookie: cafeA, body: { items: [{ productId: 'prod_custom', quantity: 2, price: 1 }] } });
  assert.equal(order.status, 201);
  assert.equal(order.data.estimatedValue, 5.11);
  assert.equal(order.data.cafeId, 'cafe_a');
  assert.equal((await app.request('/api/orders', { cookie: cafeA })).data.length, 1);
  assert.equal((await app.request('/api/orders', { cookie: cafeB })).data.length, 0);
  assert.equal((await app.request('/api/orders/' + order.data.id, { cookie: cafeB })).status, 403);
  assert.equal((await app.request('/api/orders', { cookie: admin })).data.length, 1);
  const ownCafes = (await app.request('/api/cafes', { cookie: cafeA })).data;
  assert.deepEqual(ownCafes.map((cafe: any) => cafe.id), ['cafe_a']);
});

test('legacy migration preserves custom records, never returns passwords, and runs only once across restarts', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const original = readFileSync(app.legacy, 'utf8');
  assert.equal(app.store.list('products')[0].id, 'prod_custom');
  assert.ok(!JSON.stringify(app.store.list('cafes')).includes('password'));
  assert.ok(!app.store.account('cafe_a')!.password_hash.includes('cafe-a-password'));
  const created = await app.request('/api/products', { method: 'POST', cookie, body: { name: 'New cake', price: 4.125, category: 'Cake' } });
  assert.equal(created.status, 201);
  const productId = created.data.id;
  assert.equal((await app.request('/api/products/' + productId, { method: 'PUT', cookie, body: { price: 0 } })).data.price, 0);
  assert.equal((await app.request('/api/products/prod_custom', { method: 'DELETE', cookie })).status, 200);
  await app.restart();
  assert.equal((await app.request('/api/auth/me', { cookie })).status, 200, 'persistent sessions survive server restart');
  const products = (await app.request('/api/products', { cookie })).data;
  assert.equal(products.length, 1);
  assert.equal(products[0].id, productId);
  assert.equal(products[0].price, 0);
  assert.equal(readFileSync(app.legacy, 'utf8'), original);
});

test('café accounts support credentials, unique usernames and revocation without leaking secrets', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const body = { name: 'New café', username: 'new_cafe', password: 'new-cafe-password', prices: { prod_custom: 1.234 } };
  const created = await app.request('/api/cafes', { method: 'POST', cookie, body });
  assert.equal(created.status, 201);
  assert.equal(created.data.password, undefined);
  assert.equal((await app.request('/api/cafes', { method: 'POST', cookie, body: { ...body, username: 'NEW_CAFE' } })).status, 409);
  const cafeCookie = await app.login('new_cafe', body.password);
  const cafes = (await app.request('/api/cafes', { cookie: cafeCookie })).data;
  assert.equal(cafes.length, 1);
  assert.equal(cafes[0].id, created.data.id);
  assert.equal((await app.request('/api/products', { method: 'POST', cookie: cafeCookie, body: { name: 'bad' } })).status, 403);
  assert.equal((await app.request('/api/cafes/' + created.data.id, { method: 'PUT', cookie, body: { name: 'Renamed', password: 'replacement-password' } })).status, 200);
  assert.equal((await app.request('/api/auth/me', { cookie: cafeCookie })).status, 401);
  await app.login('new_cafe', 'replacement-password');
});

test('orders enforce café ownership, validated quantities and server-controlled prices and statuses', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const cafeA = await app.login('cafe_a', 'cafe-a-password');
  const cafeB = await app.login('cafe_b', 'cafe-b-password');
  const items = [{ productId: 'prod_custom', quantity: 3, price: 0, name: 'Forged' }];
  assert.equal((await app.request('/api/orders', { method: 'POST', cookie: cafeA, body: { cafeId: 'cafe_b', items } })).status, 403);
  const created = await app.request('/api/orders', { method: 'POST', cookie: cafeA, body: { items, status: 'Livrée', estimatedValue: 0 } });
  assert.equal(created.status, 201);
  assert.equal(created.data.estimatedValue, 7.665);
  assert.equal(created.data.items[0].name, 'Pistache');
  assert.equal(created.data.status, 'En attente');
  const path = '/api/orders/' + created.data.id;
  assert.equal((await app.request(path, { cookie: cafeB })).status, 403);
  assert.equal((await app.request(path, { method: 'PUT', cookie: cafeA, body: { status: 'Livrée' } })).status, 403);
  for (const quantity of [0, -1, 1.5, '2', null]) {
    assert.equal((await app.request('/api/orders', { method: 'POST', cookie: cafeA, body: { items: [{ productId: 'prod_custom', quantity }] } })).status, 400);
  }
  assert.equal((await app.request('/api/orders', { method: 'POST', cookie, body: { cafeId: 'missing', items } })).status, 404);
  assert.equal((await app.request(path, { method: 'PUT', cookie, body: { status: 'unknown' } })).status, 400);
  assert.equal((await app.request(path, { method: 'PUT', cookie, body: { status: 'En préparation' } })).status, 200);
  assert.equal((await app.request(path, { method: 'PUT', cookie: cafeA, body: { status: 'Annulée' } })).status, 409);
  const adminNotification = (await app.request('/api/notifications', { cookie })).data[0];
  assert.equal((await app.request('/api/notifications/' + adminNotification.id + '/read', { method: 'POST', cookie: cafeB })).status, 403);
  assert.equal((await app.request('/api/notifications/' + adminNotification.id + '/read', { method: 'POST', cookie })).status, 200);
});

test('invoice totals use café prices, three decimal rounding, validated tax and immutable payment snapshots', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const cafeA = await app.login('cafe_a', 'cafe-a-password');
  const cafeB = await app.login('cafe_b', 'cafe-b-password');
  const body = { customerName: 'Café A', cafeId: 'cafe_a', items: [{ productId: 'prod_custom', quantity: 3, price: 999 }], taxEnabled: true, taxRate: 19, total: 1 };
  const invoice = await app.request('/api/invoices', { method: 'POST', cookie, body });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.data.subtotal, 7.665);
  assert.equal(invoice.data.taxAmount, 1.456);
  assert.equal(invoice.data.total, 9.121);
  assert.match(invoice.data.invoiceNumber, new RegExp(`^FACT-${new Date().getFullYear()}-0001$`));
  assert.equal((await app.request('/api/invoices/' + invoice.data.id, { cookie: cafeB })).status, 403);
  assert.equal((await app.request('/api/invoices', { cookie: cafeB })).data.length, 0);
  assert.equal((await app.request('/api/dashboard?cafeId=cafe_a', { cookie: cafeB })).data.revenueUnpaid, 0);
  assert.equal((await app.request('/api/dashboard?cafeId=cafe_b', { cookie: cafeA })).data.revenueUnpaid, 9.121);
  await app.request('/api/products/prod_custom', { method: 'DELETE', cookie });
  await app.request('/api/cafes/cafe_a', { method: 'DELETE', cookie });
  const paid = await app.request('/api/invoices/' + invoice.data.id, { method: 'PUT', cookie, body: { status: 'paid' } });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.total, 9.121);
  assert.equal(paid.data.items[0].price, 2.555);
  assert.equal((await app.request('/api/dashboard', { cookie })).data.totalSales, 9.121);
});

test('conversion is atomic, keeps ordered prices, and cannot be repeated or deleted out from under its order', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const body = { cafeId: 'cafe_a', items: [{ productId: 'prod_custom', quantity: 2 }] };
  const order = (await app.request('/api/orders', { method: 'POST', cookie, body })).data;
  await app.request('/api/cafes/cafe_a', { method: 'PUT', cookie, body: { prices: { prod_custom: 99 } } });
  const result = await Promise.all([1, 2].map(() => app.request('/api/orders/' + order.id + '/convert', { method: 'POST', cookie })));
  assert.deepEqual(result.map(r => r.status).sort(), [201, 409]);
  const invoice = result.find(r => r.status === 201)!.data.invoice;
  assert.equal(invoice.total, 5.11);
  assert.equal((await app.request('/api/invoices', { cookie })).data.length, 1);
  assert.equal((await app.request('/api/invoices/' + invoice.id, { method: 'DELETE', cookie })).status, 409);
  assert.equal((await app.request('/api/orders/' + order.id, { method: 'DELETE', cookie })).status, 409);
  await app.restart();
  assert.equal((await app.request('/api/orders/' + order.id, { cookie })).data.convertedToInvoiceId, invoice.id);
});

test('validation, free prices, drafts, cancellation and sequence non-reuse', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const invoice = { customerName: 'B', cafeId: 'cafe_b', items: [{ productId: 'prod_custom', quantity: 1 }], taxEnabled: false };
  assert.equal((await app.request('/api/invoices', { method: 'POST', cookie, body: { ...invoice, taxRate: 101 } })).status, 400);
  assert.equal((await app.request('/api/invoices', { method: 'POST', cookie, body: { ...invoice, date: '2026-02-30' } })).status, 400);
  const first = (await app.request('/api/invoices', { method: 'POST', cookie, body: invoice })).data;
  assert.equal(first.total, 0);
  await app.request('/api/invoices/' + first.id, { method: 'DELETE', cookie });
  const second = (await app.request('/api/invoices', { method: 'POST', cookie, body: { ...invoice, status: 'draft', cafeId: 'cafe_a' } })).data;
  assert.notEqual(first.invoiceNumber, second.invoiceNumber);
  const dashboard = (await app.request('/api/dashboard', { cookie })).data;
  assert.equal(dashboard.bestSellers.length, 0);
  assert.equal(dashboard.revenueUnpaid, 0);
  const order = (await app.request('/api/orders', { method: 'POST', cookie, body: { cafeId: 'cafe_b', items: invoice.items } })).data;
  await app.request('/api/orders/' + order.id, { method: 'PUT', cookie, body: { status: 'Annulée' } });
  assert.equal((await app.request('/api/orders/' + order.id + '/convert', { method: 'POST', cookie })).status, 409);
  assert.equal((await app.request('/api/missing', { cookie })).status, 404);
});

test('login rate limiting blocks repeated failed passwords', async t => {
  const app = await setup(t);
  for (let i = 0; i < 10; i++) assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { username: 'unknown', password: 'wrong-password' } })).status, 401);
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: adminPassword } })).status, 429);
});

test('products sold by weight accept fractional kg and oversized totals are rejected', async t => {
  const app = await setup(t);
  const cookie = await app.login();
  const product = (await app.request('/api/products', { method: 'POST', cookie, body: { name: 'Baklawa au kg', price: 20.5, category: 'Traditionnel' } })).data;
  const invoice = await app.request('/api/invoices', { method: 'POST', cookie, body: { customerName: 'Client', taxEnabled: false, items: [{ productId: product.id, quantity: 0.25 }] } });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.data.total, 5.125);
  const order = await app.request('/api/orders', { method: 'POST', cookie, body: { cafeId: 'cafe_a', items: [{ productId: product.id, quantity: 0.25 }] } });
  assert.equal(order.status, 201);
  assert.equal(order.data.estimatedValue, 5.125);
  assert.equal((await app.request('/api/orders', { method: 'POST', cookie, body: { cafeId: 'cafe_a', items: [{ productId: product.id, quantity: 0.0001 }] } })).status, 400);
  await app.request('/api/products/' + product.id, { method: 'PUT', cookie, body: { price: 1_000_000 } });
  assert.equal((await app.request('/api/invoices', { method: 'POST', cookie, body: { customerName: 'Client', items: [{ productId: product.id, quantity: 100_000 }] } })).status, 400);
});
