import { ArrowRight, ArrowUpRight, CakeSlice, Check, Clock3, ReceiptText, ShoppingBag } from 'lucide-react';
import type { Invoice, Order } from '../types';
import { cafeOverview } from '../cafeOverview';
import CafeCinema from './CafeCinema';

interface Props {
  user: { id: string; name: string };
  invoices: Invoice[];
  orders: Order[];
  onViewInvoice: (invoice: Invoice) => void;
  onInvoices: () => void;
  onOrders: () => void;
  onProducts: () => void;
}
const amount = (value: number) => value.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const date = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function CafeDashboardView({ user, invoices, orders, onViewInvoice, onInvoices, onOrders, onProducts }: Props) {
  const overview = cafeOverview(user.id, invoices, orders);
  const total = overview.paid + overview.outstanding;
  const paidPercent = total ? Math.round(overview.paid / total * 100) : 0;
  const maxQuantity = Math.max(...overview.favorites.map(product => product.quantity), 1);
  return <div className="dashboard-page cafe-overview">
    <header className="cafe-overview-heading"><div><span className="section-eyebrow">{user.name}</span><h1>Vue d’ensemble</h1><p>Vos factures, vos règlements et le suivi de vos commandes.</p></div><span className="quiet-badge"><ShoppingBag size={15} />{overview.activeOrders.length} commande{overview.activeOrders.length !== 1 ? 's' : ''} en cours</span></header>
    <section className="metrics-grid" aria-label="Statistiques de mon café">
      <article className="metric-card metric-featured"><div className="metric-top"><span>MES FACTURES</span><ReceiptText size={20} /></div><div className="metric-value">{overview.invoices.length.toString().padStart(2, '0')}<span>factures</span></div><div className="metric-bottom"><span>Documents de votre établissement</span><button onClick={onInvoices} aria-label="Consulter mes factures"><ArrowUpRight size={18} /></button></div></article>
      <article className="metric-card"><div className="metric-top"><span>MONTANT RÉGLÉ</span><span className="metric-icon"><Check size={19} /></span></div><div className="metric-value">{amount(overview.paid)}<span>DT</span></div><div className="metric-bottom"><span>{overview.paidCount} facture{overview.paidCount !== 1 ? 's' : ''} payée{overview.paidCount !== 1 ? 's' : ''}</span></div></article>
      <article className="metric-card metric-pending"><div className="metric-top"><span>RESTE À RÉGLER</span><span className="metric-icon"><Clock3 size={19} /></span></div><div className="metric-value">{amount(overview.outstanding)}<span>DT</span></div><div className="metric-bottom"><span className={'status-pill ' + (overview.unpaidCount ? 'status-unpaid' : 'status-paid')}><i />{overview.unpaidCount ? `${overview.unpaidCount} facture${overview.unpaidCount > 1 ? 's' : ''} à régler` : 'Vos règlements sont à jour'}</span></div></article>
    </section>
    <section className="surface recent-invoices"><div className="panel-heading"><div><span className="section-eyebrow">LES DOCUMENTS DE VOTRE CAFÉ</span><h2>Mes dernières factures</h2></div><button className="text-link" onClick={onInvoices}>Toutes mes factures <ArrowRight size={16} /></button></div><div className="table-scroll"><table className="modern-table"><thead><tr><th>Référence</th><th>Date</th><th>Montant</th><th>Statut</th><th><span className="sr-only">Consulter la facture</span></th></tr></thead><tbody>{overview.recentInvoices.map(invoice => <tr key={invoice.id}><td><button className="invoice-reference" onClick={() => onViewInvoice(invoice)}>{invoice.invoiceNumber}</button></td><td className="table-muted">{date(invoice.date)}</td><td className="table-amount">{amount(invoice.total)} <span>DT</span></td><td><span className={'status-pill status-' + invoice.status}><i />{invoice.status === 'paid' ? 'Payée' : 'À régler'}</span></td><td><button className="row-open" aria-label={'Consulter ' + invoice.invoiceNumber} onClick={() => onViewInvoice(invoice)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table>{!overview.recentInvoices.length && <div className="empty-state"><ReceiptText size={30} /><p>Vos factures apparaîtront ici après vos premières livraisons.</p></div>}</div></section>
    <div className="dashboard-panels cafe-overview-panels">
      <section className="surface"><div className="panel-heading"><div><span className="section-eyebrow">MES STATISTIQUES</span><h2>Le suivi de mon café</h2></div></div><div className="cafe-account-stats"><div className="cafe-payment-heading"><span>Factures réglées</span><strong>{paidPercent}%</strong></div><div className="cafe-payment-track" role="img" aria-label={`${paidPercent} % du montant de vos factures est réglé`}><span style={{ width: paidPercent + '%' }} /></div><div className="cafe-payment-legend"><span><i />Réglé · {amount(overview.paid)} DT</span><span><i />À régler · {amount(overview.outstanding)} DT</span></div><div className="cafe-order-counts"><div><strong>{overview.orders.length}</strong><span>commandes passées</span></div><div><strong>{overview.activeOrders.length}</strong><span>en cours</span></div><div><strong>{overview.orders.filter(order => order.status === 'Livrée').length}</strong><span>livrées</span></div></div><button className="text-link" onClick={onOrders}>Suivre mes commandes <ArrowRight size={16} /></button></div></section>
      <section className="surface bestsellers-panel"><div className="panel-heading"><div><span className="section-eyebrow">LES ENVIES DE VOTRE CAFÉ</span><h2>Mes produits favoris</h2></div><CakeSlice size={20} /></div><div className="bestseller-list">{overview.favorites.length ? overview.favorites.map((product, index) => <div key={product.id} className="bestseller-row"><span className="seller-rank">{String(index + 1).padStart(2, '0')}</span><div className="seller-details"><strong>{product.name}</strong><div className="seller-track"><span style={{ width: product.quantity / maxQuantity * 100 + '%' }} /></div></div><div className="seller-figures"><strong>{product.quantity.toLocaleString('fr-TN')}</strong><span>pièces</span></div></div>) : <div className="empty-state"><CakeSlice size={30} /><p>Vos favoris se dessineront au fil de vos factures.</p></div>}</div><div className="panel-footnote">Quantités des produits figurant sur vos factures.</div></section>
    </div>
    <CafeCinema onExplore={onProducts} />
  </div>;
}
