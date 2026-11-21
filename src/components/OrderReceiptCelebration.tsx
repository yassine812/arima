import { useEffect, useRef, useState } from 'react';
import { Check, Download, Printer, ArrowUpRight, X, Heart, LoaderCircle } from 'lucide-react';
import type { Invoice, Order } from '../types';
import { downloadInvoicePdf } from '../downloadInvoice';

export default function OrderReceiptCelebration({ order, invoice, onClose }: { order: Order; invoice: Invoice; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current!; const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const download = async () => {
    setDownloading(true); setError('');
    try { await downloadInvoicePdf(invoice); } catch (error) { setError(error instanceof Error ? error.message : 'Le PDF n’a pas pu être créé. Réessayez.'); } finally { setDownloading(false); }
  };
  const print = () => { dialog.current?.close(); onClose(); requestAnimationFrame(() => requestAnimationFrame(() => window.print())); };
  return <dialog ref={dialog} className="order-receipt-dialog no-print" aria-labelledby="receipt-title" aria-describedby="receipt-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button type="button" className="receipt-close" aria-label="Fermer la confirmation" onClick={onClose}><X size={20} /></button>
    <div className="receipt-delivery-scene" aria-hidden="true">
      <div className="receipt-petals">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--petal': index } as React.CSSProperties} />)}</div>
      <img className="receipt-dessert receipt-dessert-one" src="/brand/motion/tiramisu.svg" alt="" /><img className="receipt-dessert receipt-dessert-two" src="/brand/motion/cheesecake.svg" alt="" />
      <div className="receipt-envelope"><div className="receipt-little-paper"><span>MAISON ARIMA</span><i /><i /><i /><div className="receipt-approved"><Check size={24} /></div></div><div className="receipt-envelope-front"><Heart size={19} /></div></div>
      <span className="receipt-scene-note">Bien reçu, avec amour !</span>
    </div>
    <span className="receipt-eyebrow">VOTRE PETIT BONHEUR EST EN ROUTE</span>
    <h2 id="receipt-title">C’est bien <em>reçu !</em></h2>
    <p id="receipt-description">Votre commande est arrivée à l’atelier.<br />Sa jolie facture vous attend déjà.</p>
    <div className="receipt-document-summary"><div><span>Votre commande</span><strong>{order.orderNumber}</strong><small>{order.status === 'En attente' ? 'En attente de préparation' : order.status}</small></div><div><span>Votre facture</span><strong>{invoice.invoiceNumber}</strong><small>{invoice.total.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT · {invoice.status === 'paid' ? 'Réglée' : invoice.status === 'draft' ? 'Brouillon' : 'À régler'}</small></div></div>
    <div className="receipt-actions"><button className="btn-primary" type="button" onClick={download} disabled={downloading}>{downloading ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}{downloading ? 'Préparation du PDF…' : 'Télécharger le PDF'}</button><button className="btn-secondary" type="button" onClick={print}><Printer size={18} />Imprimer</button></div>
    {error && <p className="receipt-download-error" role="alert">{error}</p>}
    <button type="button" className="receipt-view-invoice" onClick={onClose}>Voir ma facture <ArrowUpRight size={16} /></button>
    <span className="receipt-footnote"><Check size={13} />Maison ARIMA a reçu votre commande et votre facture.</span>
  </dialog>;
}
