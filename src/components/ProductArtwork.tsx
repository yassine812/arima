import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CakeSlice } from 'lucide-react';
import { productPhoto } from '../productPhotos';
import type { Product } from '../types';
import ProductIngredients from './ProductIngredients';
import { productForeground } from '../layeredProducts';

export default function ProductArtwork({ product, children }: { product: Product; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const photo = productPhoto(product);
  const illustrated = !!photo?.includes('/illustrated/');
  const foreground = productForeground(product, photo);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '40px' });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  const accent = /pistache/.test(product.id) ? '#b5ca78' : /citron/.test(product.id) ? '#f6d666' : /fraise|framboise/.test(product.id) ? '#ef9eae' : /rafaello/.test(product.id) ? '#eee5ca' : /kids/.test(product.id) ? '#d8b2ea' : '#d8ab76';
  return <div ref={element} className={'product-visual ' + (illustrated ? 'is-illustrated ' : '') + (foreground ? 'is-layered ' : '') + (visible ? 'is-visible ' : '') + (!photo ? 'product-visual-placeholder' : '')} style={{ '--flavour-accent': accent } as CSSProperties}>
    {foreground && <span className="product-flavour-backdrop" style={{ backgroundImage: `url("${photo}")` }} aria-hidden="true" />}
    {photo ? <img className={foreground ? 'product-foreground' : undefined} src={foreground || photo} alt={product.name} loading="lazy" decoding="async" /> : <><CakeSlice size={52} strokeWidth={1} /><span>PHOTO À AJOUTER</span></>}
    {illustrated && <ProductIngredients id={product.id} />}
    {children}
  </div>;
}
