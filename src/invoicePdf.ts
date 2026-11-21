import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Invoice } from './types';

export interface InvoicePdfAssets { logo: Uint8Array; serif: Uint8Array; sans: Uint8Array; bold: Uint8Array }
const W = 595.28, H = 841.89, M = 36, R = W - M;
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const ink = '#624737', muted = '#947a66', line = '#e8d7c4', rose = '#f9e9e0', green = '#f0f2e5';
const clean = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2011\u2013\u2014]/g, '-');
const amount = (n: number) => clean(n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })) + ' DT';

/** Vector text and lines remain sharp and selectable, including across A4 pages. */
export async function buildInvoicePdf(invoice: Invoice, assets: InvoicePdfAssets) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`ARIMA - ${invoice.invoiceNumber}`); pdf.setAuthor('Maison ARIMA'); pdf.setSubject(`Facture de ${invoice.cafeName || invoice.customerName}`);
  const [serif, sans, bold, logo] = await Promise.all([pdf.embedFont(assets.serif, { subset: true }), pdf.embedFont(assets.sans, { subset: true }), pdf.embedFont(assets.bold, { subset: true }), pdf.embedPng(assets.logo)]);
  let page: PDFPage;
  const text = (value: string, x: number, top: number, size = 9, font = sans, fill = ink) => page.drawText(clean(value), { x, y: H - top - size, size, font, color: color(fill) });
  const right = (value: string, edge: number, top: number, size = 9, font = sans, fill = ink) => text(value, edge - font.widthOfTextAtSize(clean(value), size), top, size, font, fill);
  const rule = (top: number, x = M, end = R) => page.drawLine({ start: { x, y: H - top }, end: { x: end, y: H - top }, thickness: .5, color: color(line) });
  const box = (x: number, top: number, width: number, height: number, fill: string, radius = 10) => page.drawSvgPath(`M${radius} 0H${width - radius}Q${width} 0 ${width} ${radius}V${height - radius}Q${width} ${height} ${width - radius} ${height}H${radius}Q0 ${height} 0 ${height - radius}V${radius}Q0 0 ${radius} 0Z`, { x, y: H - top, color: color(fill) });
  const wrap = (value: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = []; let current = '';
    for (const word of clean(value).trim().split(/\s+/)) {
      if (font.widthOfTextAtSize((current ? current + ' ' : '') + word, size) <= width) { current += (current ? ' ' : '') + word; continue; }
      if (current) lines.push(current); current = '';
      for (const character of word) { if (font.widthOfTextAtSize(current + character, size) > width && current) { lines.push(current); current = ''; } current += character; }
    }
    if (current) lines.push(current);
    return lines;
  };
  const linesAt = (lines: string[], x: number, top: number, size: number, font = sans, fill = ink, leading = size * 1.6) => { lines.forEach((value, i) => text(value, x, top + i * leading, size, font, fill)); return lines.length * leading; };
  const stripe = () => { for (let x = M, i = 0; x < R; x += 41, i++) page.drawRectangle({ x, y: H - 39, width: Math.min(41, R - x), height: 4, color: color(['#edc9be', '#f2e6ca', '#d8dfbf'][i % 3]) }); };
  const heart = (x: number, top: number, scale = 1) => page.drawSvgPath('M12 5C2 -3 -5 9 4 16L12 23L20 16C29 9 22 -3 12 5Z', { x, y: H - top, scale, color: color('#d0a08e') });
  const cakes = (x: number, top: number) => {
    const paths = [
      ['M7 23L39 11L57 22L24 36Z', '#D8B17C'], ['M7 23L24 36V57L8 47Z', '#E8CAA0'], ['M24 36L57 22V44L24 57Z', '#F7E3BE'],
      ['M8 31L24 42L57 28V34L24 48L8 38Z', '#9B6548'], ['M8 42L24 52L57 38V43L24 57L8 47Z', '#A9764E'], ['M7 23V18L39 6L57 17V23L24 37Z', '#FFF0CE'], ['M7 18L39 6L57 17L24 31Z', '#9B6348'],
    ];
    paths.forEach(([d, fill]) => page.drawSvgPath(d, { x, y: H - top, scale: .65, color: color(fill), borderColor: color('#79503d'), borderWidth: .6 }));
    const cx = x + 58, cy = H - top - 22;
    page.drawSvgPath('M10 27L14 48Q32 63 50 48L54 27Z', { x: x + 43, y: H - top, scale: .65, color: color('#ffecc8'), borderColor: color('#8b6143'), borderWidth: .6 });
    page.drawEllipse({ x: cx + 6, y: cy + 5, xScale: 14, yScale: 8, color: color('#efa79a'), borderColor: color('#8b6143'), borderWidth: .6 });
    page.drawSvgPath('M22 22Q18 14 26 10Q32 6 38 13Q47 25 33 29Z', { x: x + 43, y: H - top, scale: .65, color: color('#d98077') });
    heart(x + 83, top - 5, .35);
  };
  const newPage = (continued = false) => {
    page = pdf.addPage([W, H]); page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: color('#fffdf7') }); stripe();
    if (continued) { text('MAISON ARIMA', M, 55, 10, bold); right(invoice.invoiceNumber + ' - suite', R, 55, 9, sans, muted); }
  };
  const tableHead = (top: number) => { box(M, top, R - M, 26, '#f5efdf', 6); text('Création', M + 12, top + 8, 8, bold, muted); right('Quantité', 340, top + 8, 8, bold, muted); right('Prix unitaire', 443, top + 8, 8, bold, muted); right('Total', R - 10, top + 8, 8, bold, muted); return top + 26; };

  newPage();
  const lx = M, lt = 52, lw = 131, lh = 77, iw = lw * 1.68, ih = logo.height * iw / logo.width;
  page.pushOperators(pushGraphicsState(), rectangle(lx, H - lt - lh, lw, lh), clip(), endPath());
  page.drawImage(logo, { x: lx + (lw - iw) / 2, y: H - lt - lh + (lh - ih) / 2, width: iw, height: ih }); page.pushOperators(popGraphicsState());
  text('LES DOUCEURS QUI NOUS RASSEMBLENT', M, 132, 5.5, bold, muted);
  right('LE CARNET DE VOTRE CAFÉ', R, 57, 6.5, bold, muted); right('Facture.', R, 72, 37, serif); right(invoice.invoiceNumber, R, 116, 8.5, bold);
  const status = invoice.status === 'paid' ? 'Réglée, merci !' : invoice.status === 'draft' ? 'Brouillon' : 'À régler';
  const statusWidth = sans.widthOfTextAtSize(status, 7) + 20;
  box(R - statusWidth, 135, statusWidth, 19, invoice.status === 'paid' ? green : rose, 9); text(status, R - statusWidth + 10, 140, 7, sans, muted);
  box(M, 171, R - M, 78, rose); text('PRÉPARÉ AVEC SOIN, PARTAGÉ AVEC VOUS', M + 18, 186, 6, bold, muted); text('Une livraison de petits bonheurs.', M + 18, 204, 21, serif); cakes(R - 111, 192);

  text('POUR NOTRE PARTENAIRE', M, 272, 6.5, bold, muted);
  let recipientBottom = 289 + linesAt(wrap(invoice.cafeName || invoice.customerName, serif, 17, 280), M, 289, 17, serif);
  if (invoice.cafeName && invoice.customerName !== invoice.cafeName) recipientBottom += linesAt(wrap(invoice.customerName, sans, 8.5, 280), M, recipientBottom + 3, 8.5);
  if (invoice.customerPhone) recipientBottom += linesAt(wrap(invoice.customerPhone, sans, 8.5, 280), M, recipientBottom + 5, 8.5, sans, muted) + 5;
  if (invoice.customerAddress) recipientBottom += linesAt(wrap(invoice.customerAddress, sans, 8.5, 280), M, recipientBottom + 5, 8.5, sans, muted) + 5;
  const factX = 365;
  text('Date d’émission', factX, 272, 7, sans, muted); text(new Date(invoice.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), factX, 285, 8.5, bold);
  text('Votre sélection', factX, 309, 7, sans, muted); text(`${invoice.items.length} création${invoice.items.length > 1 ? 's' : ''}`, factX, 322, 8.5, bold);
  text(invoice.orderNumber ? 'Commande liée' : 'Devise', factX, 346, 7, sans, muted); text(invoice.orderNumber || 'Dinar tunisien - DT', factX, 359, 8.5, bold);
  let top = Math.max(recipientBottom + 24, 391); rule(top - 11);
  text('LES DOUCEURS DE VOTRE SÉLECTION', M, top, 6.5, bold, muted); top += 21;
  if (top > 695) { newPage(true); top = 87; }
  top = tableHead(top);
  for (const [index, item] of invoice.items.entries()) {
    const name = wrap(item.name, bold, 9, 234), height = Math.max(36, name.length * 14 + 17);
    if (top + height > 748) { newPage(true); top = tableHead(87); }
    text(String(index + 1).padStart(2, '0'), M + 1, top + 12, 7, sans, muted); linesAt(name, M + 24, top + 11, 9, bold, ink, 14);
    right(item.quantity.toLocaleString('fr-TN'), 340, top + 12, 9); right(amount(item.price), 443, top + 12, 8.5); right(amount(Math.round(item.price * item.quantity * 1000) / 1000), R - 10, top + 12, 8.5, bold);
    top += height; rule(top);
  }
  if (top + 171 > 777) { newPage(true); top = 88; }
  top += 20;
  heart(M + 9, top + 15, .7); text('LA TOUCHE ARIMA', M, top + 49, 4.5, bold, muted);
  text('Merci de faire partie', M + 61, top + 12, 14, serif); text('de notre histoire.', M + 61, top + 33, 14, serif, '#b5806f'); text('Un peu de douceur, beaucoup de soin.', M + 61, top + 60, 7, sans, muted);
  const tx = 325, tw = R - tx;
  box(tx, top, tw, invoice.taxEnabled ? 137 : 119, green);
  text(invoice.taxEnabled ? 'Sous-total HT' : 'Sous-total', tx + 15, top + 14, 8, sans, muted); right(amount(invoice.subtotal), R - 15, top + 14, 8, bold);
  let totalTop = top + 44;
  if (invoice.taxEnabled) { text(`TVA - ${invoice.taxRate} %`, tx + 15, top + 36, 8, sans, muted); right(amount(invoice.taxAmount), R - 15, top + 36, 8, bold); totalTop += 20; }
  const totalText = amount(invoice.total), totalSize = Math.min(23, (tw - 30) / serif.widthOfTextAtSize(totalText, 1));
  rule(totalTop - 5, tx + 15, R - 15); text(invoice.taxEnabled ? 'Total TTC' : 'Total de la facture', tx + 15, totalTop + 6, 9, bold); right(totalText, R - 15, totalTop + 26, totalSize, serif, '#5e6b43');
  const thankYou = invoice.status === 'paid' ? 'Réglée. Merci pour votre confiance.' : invoice.status === 'draft' ? 'Document provisoire - brouillon.' : 'Merci pour votre confiance.';
  text(thankYou, tx + 15, totalTop + 61, 6.5, sans, '#7d8665');
  for (const [index, sheet] of pdf.getPages().entries()) {
    page = sheet; rule(797); text('MAISON ARIMA - Tiramisu & Cheesecake', M, 808, 6.5, sans, muted); right(`Fait avec soin en Tunisie  |  ${index + 1} / ${pdf.getPageCount()}`, R, 808, 6.5, sans, muted);
  }
  return pdf.save();
}
