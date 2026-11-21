import type { Invoice } from './types';
import type { InvoicePdfAssets } from './invoicePdf';

let assets: Promise<InvoicePdfAssets> | undefined;
async function getAssets() {
  if (!assets) assets = (async () => {
    const paths = ['/brand/arima-logo-v2.png', '/fonts/invoices/fraunces-latin-400-normal.woff', '/fonts/invoices/plus-jakarta-sans-latin-400-normal.woff', '/fonts/invoices/plus-jakarta-sans-latin-600-normal.woff'];
    const [logo, serif, sans, bold] = await Promise.all(paths.map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Les éléments du PDF n’ont pas pu être chargés. Réessayez.');
      return new Uint8Array(await response.arrayBuffer());
    }));
    return { logo, serif, sans, bold };
  })().catch(error => { assets = undefined; throw error; });
  return assets;
}

export async function downloadInvoicePdf(invoice: Invoice) {
  const [{ buildInvoicePdf }, resources] = await Promise.all([import('./invoicePdf'), getAssets()]);
  const bytes = await buildInvoicePdf(invoice, resources);
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ARIMA-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
