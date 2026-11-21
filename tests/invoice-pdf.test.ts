import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { buildInvoicePdf } from '../src/invoicePdf';
import type { Invoice } from '../src/types';

async function resources() {
  const [logo, serif, sans, bold] = await Promise.all(['public/brand/arima-logo-v2.png', 'public/fonts/invoices/fraunces-latin-400-normal.woff', 'public/fonts/invoices/plus-jakarta-sans-latin-400-normal.woff', 'public/fonts/invoices/plus-jakarta-sans-latin-600-normal.woff'].map(path => readFile(path)));
  return { logo, serif, sans, bold };
}
const invoice: Invoice = { id: 'pdf', invoiceNumber: 'FACT-PDF-TEST', date: '2026-11-21', customerName: 'Café Démonstration', customerPhone: '', customerAddress: '12, rue des Douceurs', items: [{ productId: 'p', name: 'Tiramisu Pistache', price: 4, quantity: 3 }], subtotal: 12, taxEnabled: true, taxRate: 19, taxAmount: 2.28, total: 14.28, status: 'unpaid' };

test('download generates a genuine A4 PDF with embedded local brand resources', async () => {
  const bytes = await buildInvoicePdf(invoice, await resources());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), 'ARIMA - FACT-PDF-TEST'); assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPages()[0].getWidth() - 595.28) < .01);
  assert.ok(Math.abs(pdf.getPages()[0].getHeight() - 841.89) < .01);
});
test('long selections paginate into valid A4 pages without mutating the invoice snapshot', async () => {
  const many = { ...invoice, items: Array.from({ length: 80 }, (_, i) => ({ ...invoice.items[0], productId: String(i), name: 'Mini tiramisu aux noisettes grillées et à la crème mascarpone de la maison' })) };
  const before = JSON.stringify(many);
  const pdf = await PDFDocument.load(await buildInvoicePdf(many, await resources()));
  assert.ok(pdf.getPageCount() > 1); assert.equal(JSON.stringify(many), before);
  assert.ok(pdf.getPages().every(page => Math.abs(page.getHeight() - 841.89) < .01));
});
