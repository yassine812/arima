import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../backend/postgres';
import { createApp } from '../backend/app';

// Run the production SQL against an actual PostgreSQL engine in memory.
// The adapter only replaces the TCP transport, not database queries/results.
function sqlClient(database: PGlite) {
  function scoped(connection: Pick<PGlite, 'query' | 'exec'>): any {
    const query: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
      return (await connection.query(sql, values)).rows;
    };
    query.unsafe = async (sql: string, params: unknown[] = []) => {
      if (params.length) return (await connection.query(sql, params)).rows;
      return (await connection.exec(sql)).at(-1)?.rows || [];
    };
    query.json = JSON.stringify;
    query.begin = (fn: (sql: any) => unknown) => database.transaction(async transaction => fn(scoped(transaction)));
    query.end = () => database.close();
    return query;
  }
  return scoped(database);
}

test('production PostgreSQL: bootstrap, accounts, café isolation, order conversion and rollback', async t => {
  const db = new PGlite();
  const store = new PostgresStore('postgres://test', sqlClient(db));
  await store.initialize('admin', 'test-admin-password');
  await store.initialize('admin', 'must-not-reset-admin');
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.close(); });
  const request = async (path: string, method = 'GET', body?: unknown, cookie?: string) => {
    const result = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: result.status, data: await result.json(), cookie: result.headers.get('set-cookie')?.split(';')[0] };
  };
  assert.equal((await request('/api/health')).data.database, 'postgres');
  assert.equal((await request('/api/invoices')).status, 401);
  const admin = (await request('/api/auth/login', 'POST', { username: 'admin', password: 'test-admin-password' })).cookie;
  assert.ok(admin);
  const cafe = (await request('/api/cafes', 'POST', { name: 'Café A', username: 'cafe-a', password: 'test-cafe-password', prices: {} }, admin)).data;
  const second = (await request('/api/cafes', 'POST', { name: 'Café B', username: 'cafe-b', password: 'test-cafe-password', prices: {} }, admin)).data;
  assert.ok(cafe.id);
  assert.equal((await request('/api/cafes', 'POST', { name: 'Duplicate', username: 'cafe-a', password: 'test-cafe-password', prices: {} }, admin)).status, 409);
  const cookie = (await request('/api/auth/login', 'POST', { username: 'cafe-a', password: 'test-cafe-password' })).cookie;
  assert.ok(cookie);
  const products = (await request('/api/products', 'GET', undefined, cookie)).data;
  assert.equal(products.length, 29);
  const body = { submissionKey: 'postgres-checkout-20261121', items: [{ productId: products[0].id, quantity: 2 }] };
  const order = await request('/api/orders', 'POST', body, cookie);
  assert.equal(order.status, 201);
  assert.equal(order.data.cafeId, cafe.id);
  assert.equal((await request('/api/orders', 'POST', { ...body, cafeId: second.id }, cookie)).status, 403);
  const result = { data: { invoice: order.data.invoice } };
  assert.ok(result.data.invoice.id);
  assert.equal(order.data.status, 'En attente');
  const retry = await request('/api/orders', 'POST', body, cookie);
  assert.equal(retry.data.id, order.data.id);
  assert.equal(retry.data.invoice.id, result.data.invoice.id);
  assert.equal((await request(`/api/orders/${order.data.id}/convert`, 'POST', {}, admin)).status, 409);
  assert.equal((await request('/api/invoices', 'GET', undefined, cookie)).data.length, 1);
  const secondCookie = (await request('/api/auth/login', 'POST', { username: 'cafe-b', password: 'test-cafe-password' })).cookie;
  assert.equal((await request('/api/invoices', 'GET', undefined, secondCookie)).data.length, 0);
  assert.equal((await request(`/api/invoices/${result.data.invoice.id}`, 'GET', undefined, secondCookie)).status, 403);
  assert.equal((await request('/api/dashboard', 'GET', undefined, cookie)).data.revenueUnpaid, result.data.invoice.total);
  const adminNotes = (await request('/api/notifications', 'GET', undefined, admin)).data;
  assert.equal(adminNotes.length, 2);
  assert.ok(adminNotes.every((note: any) => note.invoiceId === result.data.invoice.id));
  const statusUpdate = await request(`/api/orders/${order.data.id}`, 'PUT', { status: 'En préparation' }, admin);
  assert.equal(statusUpdate.status, 200);
  const manual = await request('/api/orders', 'POST', { cafeId: cafe.id, items: body.items }, admin);
  assert.equal((await request(`/api/orders/${manual.data.id}/convert`, 'POST', {}, admin)).status, 201);
  await assert.rejects(store.transaction(async () => { await store.remove('invoices', result.data.invoice.id); throw new Error('rollback'); }), /rollback/);
  assert.ok(await store.get('invoices', result.data.invoice.id));
  const before = await store.transaction(async () => store.nextNumber('invoices'));
  const after = await store.transaction(async () => store.nextNumber('invoices'));
  assert.equal(Number(after.slice(-4)), Number(before.slice(-4)) + 1);
});
