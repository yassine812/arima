import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cafeOverview } from '../src/cafeOverview';
import type { Invoice, Order } from '../src/types';

test('café overview shows only its issued invoices and own orders, with purchase-side totals', () => {
  const invoice = (id: string, cafeId: string, status: Invoice['status'], total: number, quantity = 1): Invoice => ({ id, cafeId, status, total, invoiceNumber: id, date: '2026-11-20', customerName: cafeId, customerPhone: '', customerAddress: '', subtotal: total, taxEnabled: false, taxRate: 0, taxAmount: 0, items: [{ productId: 'p', name: 'Pistache', price: total, quantity }] });
  const invoices = [invoice('one', 'a', 'paid', 12.345, 2), invoice('two', 'a', 'paid', 1.111), invoice('three', 'a', 'unpaid', 8.999), invoice('draft', 'a', 'draft', 100), invoice('foreign', 'b', 'paid', 999)];
  const orders = [{ id: 'o1', cafeId: 'a', status: 'En préparation' }, { id: 'o2', cafeId: 'a', status: 'Annulée' }, { id: 'o3', cafeId: 'b', status: 'En attente' }] as Order[];
  const result = cafeOverview('a', invoices, orders);
  assert.equal(result.paid, 13.456);
  assert.equal(result.outstanding, 8.999);
  assert.equal(result.invoices.length, 3);
  assert.equal(result.paidCount, 2);
  assert.equal(result.unpaidCount, 1);
  assert.deepEqual(result.orders.map(order => order.id), ['o1', 'o2']);
  assert.deepEqual(result.activeOrders.map(order => order.id), ['o1']);
  assert.equal(result.favorites[0].quantity, 4);
  assert.ok(result.recentInvoices.every(invoice => invoice.cafeId === 'a' && invoice.status !== 'draft'));
});

test('new café has empty statistics even when other cafés have invoices', () => {
  const result = cafeOverview('new-cafe', [], []);
  assert.equal(result.paid, 0);
  assert.equal(result.outstanding, 0);
  assert.deepEqual(result.favorites, []);
  assert.deepEqual(result.recentInvoices, []);
});
