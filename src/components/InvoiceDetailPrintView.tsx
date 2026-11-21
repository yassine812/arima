import { ArrowLeft, Printer, Check, Heart, Sparkles, MapPin, Phone, CakeSlice } from 'lucide-react';
import type { Invoice } from '../types';
import BrandLogo from './BrandLogo';

interface InvoiceDetailPrintViewProps {
  invoice: Invoice;
  onBack: () => void;
  onMarkAsPaid?: (id: string) => Promise<void>;
}
const formatDT = (value: number) => `${value.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const statuses = { paid: 'Réglée, merci !', unpaid: 'À régler', draft: 'Brouillon' };

export default function InvoiceDetailPrintView({ invoice, onBack, onMarkAsPaid }: InvoiceDetailPrintViewProps) {
  const date = new Date(`${invoice.date.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const quantity = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="invoice-detail-page invoice-stationery">
    <div className="invoice-detail-toolbar invoice-screen-tools no-print">
      <div className="invoice-screen-title"><button type="button" className="icon-button" aria-label="Retour" onClick={onBack}><ArrowLeft size={19} /></button><div><span className="section-eyebrow">LES PAPIERS DE LA MAISON</span><h1>Votre facture.</h1></div></div>
      <div className="invoice-screen-actions">{invoice.status !== 'paid' && onMarkAsPaid && <button type="button" className="btn-secondary" onClick={() => onMarkAsPaid(invoice.id)}><Check size={17} />Marquer comme payée</button>}<button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={17} />Imprimer / PDF</button></div>
    </div>
    <article className="print-card invoice-paper" aria-label={`Facture ${invoice.invoiceNumber}`}>
      <header className="invoice-letterhead">
        <div className="invoice-brand-block"><BrandLogo className="invoice-brand" /><span>LES DOUCEURS QUI NOUS RASSEMBLENT</span></div>
        <div className="invoice-heading-block"><span className="invoice-kicker">LE CARNET DE VOTRE CAFÉ</span><h2>Facture<span aria-hidden="true">.</span></h2><strong>{invoice.invoiceNumber}</strong><span className={`invoice-payment-status is-${invoice.status}`}>{invoice.status === 'paid' ? <Check size={13} /> : <span className="invoice-status-dot" />}{statuses[invoice.status]}</span></div>
      </header>
      <section className="invoice-greeting" aria-label="La touche ARIMA"><div><span className="invoice-kicker">PRÉPARÉ AVEC SOIN, PARTAGÉ AVEC VOUS</span><p>Une livraison de <em>petits bonheurs.</em></p></div><div className="invoice-dessert-duo" aria-hidden="true"><Sparkles className="invoice-doodle-spark" size={21} /><img src="/brand/motion/tiramisu.svg" alt="" /><img src="/brand/motion/cheesecake.svg" alt="" /><Heart className="invoice-doodle-heart" size={18} /></div></section>
      <section className="invoice-parties" aria-label="Informations de facturation">
        <div className="invoice-recipient"><span className="invoice-kicker">POUR NOTRE PARTENAIRE</span><h3>{invoice.cafeName || invoice.customerName}</h3>{invoice.cafeName && invoice.customerName !== invoice.cafeName && <p>{invoice.customerName}</p>}{invoice.customerPhone && <p><Phone size={13} />{invoice.customerPhone}</p>}{invoice.customerAddress && <p><MapPin size={13} /><span>{invoice.customerAddress}</span></p>}</div>
        <dl className="invoice-facts"><div><dt>Date d’émission</dt><dd>{date}</dd></div><div><dt>Votre sélection</dt><dd>{invoice.items.length} création{invoice.items.length > 1 ? 's' : ''} <span>· {quantity.toLocaleString('fr-TN')} unité{quantity > 1 ? 's' : ''}</span></dd></div><div><dt>Devise</dt><dd>Dinar tunisien <span>· DT</span></dd></div></dl>
      </section>
      <section className="invoice-selection" aria-label="Détail des produits"><div className="invoice-section-label"><CakeSlice size={16} /><span>LES DOUCEURS DE VOTRE SÉLECTION</span><span className="invoice-section-rule" /></div>
        <table className="invoice-items-table"><thead><tr><th scope="col">Création</th><th scope="col">Quantité</th><th scope="col">Prix unitaire</th><th scope="col">Total</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td data-label="Produit"><span className="invoice-item-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{item.name}</span></td><td data-label="Quantité">{item.quantity.toLocaleString('fr-TN')}</td><td data-label="Prix unitaire">{formatDT(item.price)}</td><td data-label="Total">{formatDT(Math.round(item.price * item.quantity * 1000) / 1000)}</td></tr>)}</tbody></table>
      </section>
      <div className="invoice-closing">
        <aside className="invoice-thank-you"><div className="invoice-thanks-seal" aria-hidden="true"><Heart size={22} /><span>LA TOUCHE ARIMA</span></div><p>Merci de faire partie<br />de <em>notre histoire.</em></p><span>Un peu de douceur,<br />beaucoup de soin.</span></aside>
        <section className="invoice-totals" aria-label="Montants de la facture"><div><span>Sous-total{invoice.taxEnabled ? ' HT' : ''}</span><strong>{formatDT(invoice.subtotal)}</strong></div>{invoice.taxEnabled && <div><span>TVA · {invoice.taxRate.toLocaleString('fr-TN')} %</span><strong>{formatDT(invoice.taxAmount)}</strong></div>}<div className="invoice-grand-total"><span>Total {invoice.taxEnabled ? 'TTC' : 'de la facture'}<small>DINAR TUNISIEN</small></span><strong>{formatDT(invoice.total)}</strong></div><p>{invoice.status === 'paid' ? <><Check size={13} />Cette facture a été réglée. Merci pour votre confiance.</> : invoice.status === 'draft' ? 'Document provisoire · facture en cours de préparation.' : 'Merci pour votre confiance et votre fidélité.'}</p></section>
      </div>
      <footer className="invoice-paper-footer"><span>MAISON ARIMA <i>·</i> Tiramisu & Cheesecake</span><span>Fait avec <Heart size={11} fill="currentColor" /> en Tunisie</span></footer>
    </article>
    <details className="invoice-export-help no-print"><summary><Printer size={15} />Imprimer ou enregistrer un PDF</summary><p>Choisissez le format A4, puis « Enregistrer en PDF » ou votre imprimante. Activez les arrière-plans pour retrouver les couleurs de la maison et désactivez les en-têtes et pieds de page du navigateur.</p></details>
  </div>;
}
