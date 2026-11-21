import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceDetailPrintView from '../src/components/InvoiceDetailPrintView';
import type { Invoice } from '../src/types';

const invoice: Invoice = { id: 'test', invoiceNumber: 'FACT-TEST', date: '2026-11-21', customerName: 'Café Démonstration', customerPhone: '', customerAddress: 'Rue des Douceurs', items: [{ productId: 'p', name: 'Tiramisu Pistache', price: 4, quantity: 3 }], subtotal: 12, taxEnabled: true, taxRate: 19, taxAmount: 2.28, total: 14.28, status: 'unpaid' };

test('invoice document includes recorded TVA and total, rather than presenting the untaxed item sum as the total', () => {
  const html = renderToStaticMarkup(createElement(InvoiceDetailPrintView, { invoice, onBack() {} }));
  assert.match(html, /Sous-total HT/);
  assert.match(html, /TVA · 19/);
  assert.match(html, /2,280 DT/);
  assert.match(html, /Total TTC/);
  assert.match(html, /14,280 DT/);
  assert.match(html, /Rue des Douceurs/);
  assert.doesNotMatch(html, /Marquer comme payée/);
});

test('untaxed paid invoices retain their recorded amount and do not show a fictitious TVA line', () => {
  const html = renderToStaticMarkup(createElement(InvoiceDetailPrintView, { invoice: { ...invoice, status: 'paid', taxEnabled: false, taxAmount: 0, total: 12 }, onBack() {} }));
  assert.match(html, /Réglée, merci !/);
  assert.match(html, /12,000 DT/);
  assert.doesNotMatch(html, /TVA ·|Total TTC|Marquer comme payée/);
});
