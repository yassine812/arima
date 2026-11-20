import { ChevronDown, Coffee } from 'lucide-react';
import type { Cafe, Product } from '../types';

const amount = (price: number) => price.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function ProductCafePrices({ product, cafes }: { product: Product; cafes: Cafe[] }) {
  return <details className="product-cafe-prices">
    <summary aria-label={`Prix de ${product.name} pour tous les cafés`}>
      <Coffee size={16} aria-hidden="true" />
      <span>Prix par café</span>
      <span className="cafe-price-count">{cafes.length}</span>
      <ChevronDown className="cafe-price-chevron" size={15} aria-hidden="true" />
    </summary>
    <div className="cafe-prices-content">
      <div className="cafe-catalogue-price"><span>Prix catalogue</span><strong>{amount(product.price)} <small>DT</small></strong></div>
      {cafes.length > 0 ? <ul className="cafe-price-list" aria-label={`Tarifs de ${product.name} par café`}>
        {cafes.map(cafe => {
          const override = cafe.prices?.[product.id];
          const custom = override !== undefined && override !== null;
          const price = override ?? product.price;
          return <li key={cafe.id}>
            <div><strong>{cafe.name}</strong><span className={custom ? 'is-custom-price' : ''}>{custom ? 'Tarif personnalisé' : 'Prix catalogue'}</span></div>
            <span className="cafe-unit-price">{amount(price)} <small>DT</small></span>
          </li>;
        })}
      </ul> : <p className="cafe-prices-empty">Aucun café partenaire pour le moment.</p>}
      {cafes.length > 0 && <p className="cafe-price-note">Sans tarif personnalisé, le prix catalogue s’applique.</p>}
    </div>
  </details>;
}
