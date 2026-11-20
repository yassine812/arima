import type { Invoice, Order } from './types';

const money = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

// Keep the café dashboard independent of the administrator's sales dashboard.
export function cafeOverview(cafeId: string, invoices: Invoice[], orders: Order[]) {
  const ownInvoices = invoices.filter(invoice => invoice.cafeId === cafeId && invoice.status !== 'draft');
  const ownOrders = orders.filter(order => order.cafeId === cafeId);
  const paid = money(ownInvoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0));
  const outstanding = money(ownInvoices.filter(invoice => invoice.status === 'unpaid').reduce((sum, invoice) => sum + invoice.total, 0));
  const products = new Map<string, { id: string; name: string; quantity: number }>();
  for (const invoice of ownInvoices) for (const item of invoice.items) {
    const product = products.get(item.productId) || { id: item.productId, name: item.name, quantity: 0 };
    product.quantity += item.quantity;
    products.set(item.productId, product);
  }
  return {
    invoices: ownInvoices,
    recentInvoices: [...ownInvoices].sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNumber.localeCompare(a.invoiceNumber)).slice(0, 5),
    orders: ownOrders,
    activeOrders: ownOrders.filter(order => !['Livrée', 'Annulée'].includes(order.status)),
    paid,
    outstanding,
    paidCount: ownInvoices.filter(invoice => invoice.status === 'paid').length,
    unpaidCount: ownInvoices.filter(invoice => invoice.status === 'unpaid').length,
    favorites: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 4),
  };
}
