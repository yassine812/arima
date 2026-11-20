import { useMemo, useState } from 'react';
import { Coffee, Search, ShoppingBag, ArrowUpRight, Layers3 } from 'lucide-react';
import type { Product } from '../types';
import AtelierHero from './AtelierHero';
import ProductArtwork from './ProductArtwork';

interface Props {
  products: Product[];
  cafeName: string;
  onStartOrder: () => void;
  onOrderProduct: (productId: string) => void;
  onViewCatalogues: () => void;
}
const categoryOrder = ['Cheesecakes', 'Tiramisus', 'Mini tiramisus'];

export default function CafeProductsView({ products, cafeName, onStartOrder, onOrderProduct, onViewCatalogues }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort((a, b) => {
    const rank = (value: string) => categoryOrder.includes(value) ? categoryOrder.indexOf(value) : 99;
    return rank(a) - rank(b) || a.localeCompare(b, 'fr');
  }), [products]);
  const filtered = products.filter(p => (category === 'all' || category === p.category)
    && `${p.name} ${p.description} ${p.category}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr').trim()));

  return <div className="catalog-page cafe-products-page">
    <AtelierHero kind="pistache" eyebrow="LA CARTE DE VOTRE CAFÉ" title={<>À partager,<br /><em>à savourer.</em></>} description="Les créations de la maison, prêtes à rejoindre votre carte. Composez votre commande à votre rythme.">
      <button className="btn-primary" onClick={onStartOrder}><ShoppingBag size={17} />Passer une commande</button>
      <button className="btn-secondary" onClick={onViewCatalogues}>Voir les catalogues<ArrowUpRight size={16} /></button>
    </AtelierHero>
    <div className="cafe-partner-note"><span className="cafe-partner-icon"><Coffee size={23} /></span><div><strong>{cafeName}</strong><p>Vos tarifs partenaires sont affichés ci-dessous et appliqués à votre commande.</p></div><span className="cafe-role-badge">ESPACE CAFÉ</span></div>
    <div className="catalog-toolbar">
      <div className="category-tabs" aria-label="Familles de pâtisseries">
        <button aria-pressed={category === 'all'} className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}><Layers3 size={17} />Tout<span>{products.length}</span></button>
        {categories.map(value => <button key={value} aria-pressed={category === value} className={category === value ? 'is-active' : ''} onClick={() => setCategory(value)}>{value}<span>{products.filter(p => p.category === value).length}</span></button>)}
      </div>
      <label className="catalog-search"><Search size={17} /><span className="sr-only">Rechercher un produit</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Une envie, une saveur…" /></label>
    </div>
    <div className="catalog-results"><span>{filtered.length} création{filtered.length !== 1 ? 's' : ''}</span><span>VOS TARIFS PARTENAIRES · DT</span></div>
    <div className="product-grid">{filtered.map(product => <article key={product.id} className="product-card cafe-product-card">
      <ProductArtwork product={product}><span className="product-category">{product.category}</span></ProductArtwork>
      <div className="product-body"><h2>{product.name}</h2><p>{product.description || 'Une création signée Maison ARIMA.'}</p><div className="product-card-footer"><span className="product-price">{product.price.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}<small>DT / pièce</small></span></div>
        <button className="btn-primary cafe-order-product" aria-label={'Commander ' + product.name} onClick={() => onOrderProduct(product.id)}><ShoppingBag size={16} />Commander<ArrowUpRight size={15} /></button>
      </div>
    </article>)}</div>
    {filtered.length === 0 && <div className="empty-state surface"><Search size={30} /><h2>Aucune création trouvée.</h2><p>Essayez une autre saveur ou une autre famille.</p><button className="btn-secondary" onClick={() => { setQuery(''); setCategory('all'); }}>Voir tous les produits</button></div>}
  </div>;
}
