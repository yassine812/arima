import { ArrowUpRight, ArrowRight, Coffee, ReceiptText, Clock3, CakeSlice, CalendarDays } from 'lucide-react';
import type { DashboardStats, Invoice, Cafe } from '../types';
import { productPhoto } from '../productPhotos';
import AtelierHero from './AtelierHero';

interface Props {
  stats: DashboardStats;
  onViewInvoice: (invoice: Invoice) => void;
  onNavigateToInvoices: () => void;
  onNavigateToProducts?: () => void;
  cafes: Cafe[];
  selectedCafeId: string;
  onSelectedCafeChange: (id: string) => void;
}
const amount = (n: number) => n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const colors = ['#C6837B', '#95AA77', '#C69B65', '#A395AE', '#D8B47D'];
export default function DashboardView({ stats, onViewInvoice, onNavigateToInvoices, onNavigateToProducts, cafes, selectedCafeId, onSelectedCafeChange }: Props) {
  const { totalSales = 0, totalOrders = 0, revenueUnpaid = 0, bestSellers = [], categorySales = [], recentInvoices = [] } = stats;
  const categoryTotal = categorySales.reduce((sum, c) => sum + c.value, 0);
  const collectionPercent = totalSales + revenueUnpaid > 0 ? Math.round(totalSales / (totalSales + revenueUnpaid) * 100) : 0;
  const maxQuantity = Math.max(...bestSellers.map(s => s.quantity), 1);
  let angle = 0;
  const stops = categorySales.map((c, i) => { const start = angle; angle += categoryTotal ? c.value / categoryTotal * 360 : 0; return colors[i % colors.length] + ' ' + start + 'deg ' + angle + 'deg'; });
  const categoryBackground = categoryTotal ? 'conic-gradient(' + stops.join(',') + ')' : '#eae5dc';

  return <div className="dashboard-page">
    <AtelierHero welcome eyebrow="BIENVENUE À L’ATELIER" title={<>Une belle journée<br />à <em>l’atelier.</em></>} description="Vos petites créations font les grandes journées. On s’occupe de la suite ?">
      <div className="intro-tools"><div className="date-label"><CalendarDays size={15} /><time>{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</time></div><label className="cafe-filter"><Coffee size={16} /><span className="sr-only">Filtrer par café</span><select value={selectedCafeId} onChange={e => onSelectedCafeChange(e.target.value)}><option value="all">Tous les établissements</option>{cafes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    </AtelierHero>
    <section className="metrics-grid" aria-label="Chiffres clés">
      <article className="metric-card metric-featured"><div className="metric-top"><span>CHIFFRE D’AFFAIRES ENCAISSÉ</span><ArrowUpRight size={20} /></div><div className="metric-value">{amount(totalSales)}<span>DT</span></div><div className="metric-bottom"><span className="metric-dot" />Factures réglées<div className="collection-mini"><span style={{ width: collectionPercent + '%' }} /></div><strong>{collectionPercent}%</strong></div></article>
      <article className="metric-card"><div className="metric-top"><span>FACTURES ÉMISES</span><span className="metric-icon"><ReceiptText size={19} strokeWidth={1.5} /></span></div><div className="metric-value">{totalOrders.toString().padStart(2, '0')}<span>factures</span></div><div className="metric-bottom"><span>L’ensemble de vos factures</span><button onClick={onNavigateToInvoices} aria-label="Consulter les factures"><ArrowUpRight size={18} /></button></div></article>
      <article className="metric-card metric-pending"><div className="metric-top"><span>RESTE À ENCAISSER</span><span className="metric-icon"><Clock3 size={19} strokeWidth={1.5} /></span></div><div className="metric-value">{amount(revenueUnpaid)}<span>DT</span></div><div className="metric-bottom"><span className={'status-pill ' + (revenueUnpaid > 0 ? 'status-unpaid' : 'status-paid')}><i />{revenueUnpaid > 0 ? 'En attente de règlement' : 'Tous les règlements à jour'}</span></div></article>
    </section>
    <div className="dashboard-panels">
      <section className="surface bestsellers-panel"><div className="panel-heading"><div><span className="section-eyebrow">LES FAVORIS DE LA MAISON</span><h2>Vos créations à succès</h2></div><span className="quiet-badge">Top {bestSellers.length}</span></div>
        <div className="bestseller-list">{bestSellers.length === 0 ? <div className="empty-state"><CakeSlice size={32} /><p>Les premières ventes écriront la suite.</p></div> : bestSellers.map((seller, i) => <div key={seller.id} className="bestseller-row"><span className="seller-rank">{String(i + 1).padStart(2, '0')}</span><div className="seller-photo">{productPhoto(seller) ? <img src={productPhoto(seller)} alt="" loading="lazy" /> : <CakeSlice size={23} strokeWidth={1.3} />}</div><div className="seller-details"><strong>{seller.name}</strong><div className="seller-track"><span style={{ width: Math.max(5, seller.quantity / maxQuantity * 100) + '%', background: colors[i % colors.length] }} /></div></div><div className="seller-figures"><strong>{amount(seller.revenue)} <span>DT</span></strong><span>{seller.quantity} {/(kg|baklawa|kaak|samsa)/i.test(seller.name) ? 'kg' : 'pièces'}</span></div></div>)}</div>
        <div className="panel-footnote">Classement selon les quantités des factures hors brouillons.</div>
      </section>
      <section className="surface categories-panel"><div className="panel-heading"><div><span className="section-eyebrow">VOTRE SIGNATURE GOURMANDE</span><h2>Les familles de saveurs</h2></div></div><div className="category-donut" role="img" aria-label={'Répartition des ventes : ' + categorySales.map(c => c.name + ' ' + amount(c.value) + ' DT').join(', ')} style={{ background: categoryBackground }}><div><span>VENTES PRODUITS</span><strong>{categoryTotal.toLocaleString('fr-TN', { maximumFractionDigits: 3 })}</strong><span>DINARS TUNISIENS</span></div></div><div className="category-legend">{categorySales.length ? categorySales.map((c, i) => <div key={c.name}><span><i style={{ background: colors[i % colors.length] }} />{c.name}</span><strong>{categoryTotal ? Math.round(c.value / categoryTotal * 100) : 0}<small>%</small></strong></div>) : <p className="empty-copy">La répartition apparaîtra avec vos premières ventes.</p>}</div></section>
    </div>
    <section className="surface recent-invoices"><div className="panel-heading"><div><span className="section-eyebrow">LE FIL DE VOTRE ACTIVITÉ</span><h2>Dernières factures</h2></div><button className="text-link" onClick={onNavigateToInvoices}>Tout consulter <ArrowRight size={16} /></button></div><div className="table-scroll"><table role="table" className="modern-table mobile-record-table"><thead><tr><th>Référence</th><th>Établissement / client</th><th>Date</th><th>Montant</th><th>Statut</th><th><span className="sr-only">Ouvrir la facture</span></th></tr></thead><tbody>{recentInvoices.map(invoice => <tr key={invoice.id}><td data-label="Référence"><button className="invoice-reference" onClick={() => onViewInvoice(invoice)}>{invoice.invoiceNumber}</button></td><td data-label="Client"><div className="table-client"><span className="client-avatar">{(invoice.cafeName || invoice.customerName).replace(/^Café\s*/i, '').slice(0, 1)}</span><strong>{invoice.cafeName || invoice.customerName}</strong></div></td><td data-label="Date" className="table-muted">{new Date(invoice.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td data-label="Montant" className="table-amount">{amount(invoice.total)} <span>DT</span></td><td data-label="Statut"><span className={'status-pill status-' + invoice.status}><i />{invoice.status === 'paid' ? 'Payée' : invoice.status === 'draft' ? 'Brouillon' : 'À régler'}</span></td><td data-label="Actions"><button className="row-open" aria-label={'Ouvrir ' + invoice.invoiceNumber} onClick={() => onViewInvoice(invoice)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table>{recentInvoices.length === 0 && <div className="empty-state"><ReceiptText size={30} /><p>Votre première facture commence ici.</p></div>}</div></section>
    {onNavigateToProducts && <section className="collection-banner"><div><span className="section-eyebrow">UNE COLLECTION QUI VOUS RESSEMBLE</span><h2>Le goût du détail.<br /><em>Jusqu’à la dernière création.</em></h2><button className="text-link" onClick={onNavigateToProducts}>Explorer le catalogue <ArrowRight size={17} /></button></div><div className="collection-photos" aria-hidden="true"><img src="/products/illustrated/tira_pistache.png" alt="" loading="lazy" /><img src="/products/illustrated/cheese_oreo.png" alt="" loading="lazy" /></div></section>}
  </div>;
}

