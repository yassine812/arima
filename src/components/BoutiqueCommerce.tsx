import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CakeSlice, Check, CheckCircle2, Heart, LoaderCircle, Minus, Plus, Printer, RefreshCw, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartSelection, ShopCatalog, ShopCustomer, ShopProduct, ShopQuote, ShopReceipt } from '../storefrontTypes';
import ProductArtwork from './ProductArtwork';
import AtelierArt from './AtelierArt';
import BrandLogo from './BrandLogo';
import { shopArtwork } from '../storefrontArtwork';
import '../boutique-commerce.css';
import '../boutique-product.css';

const CART_KEY = 'arima-public-cart-v1';
const PENDING_KEY = 'arima-public-pending-v1';
const official = 'https://arima.converty.shop';
export const shopMoney = (value: number) => `${value.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
class CheckoutError extends Error { constructor(message: string, readonly code?: string, readonly details?: any) { super(message); } }
async function shopRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/boutique/${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new CheckoutError(data.error || 'La boutique met du temps à répondre.', data.code, data.details);
  return data;
}
function readCart(): CartSelection[] {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(data) ? data.filter(item => /^[a-f\d]{24}$/i.test(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 50 && (!item.variantId || typeof item.variantId === 'string')).slice(0, 20) : [];
  } catch { return []; }
}
const lineKey = (item: CartSelection) => `${item.productId}:${item.variantId || ''}:${item.bundleId || ''}`;
interface ShopContextValue {
  catalog: ShopCatalog | null; cart: CartSelection[]; count: number; open: () => void;
  add: (product: ShopProduct, variantId?: string, bundleId?: string, quantity?: number) => void; change: (item: CartSelection, quantity: number) => void;
  view: (product: ShopProduct, variantId?: string, bundleId?: string) => void;
  pending: { attemptKey: string; items: CartSelection[] } | null;
}
const ShopContext = createContext<ShopContextValue | null>(null);
export const useBoutique = () => useContext(ShopContext)!;

export function BoutiqueProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [cart, setCart] = useState<CartSelection[]>(readCart);
  const [opened, setOpened] = useState(false);
  const [detail, setDetail] = useState<{ product: ShopProduct; variantId?: string; bundleId?: string } | null>(null);
  const [pending, setPendingState] = useState<ShopContextValue['pending']>(() => {
    try { const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); return value && /^[a-f\d-]{36}$/i.test(value.attemptKey) && Array.isArray(value.items) ? value : null; } catch { return null; }
  });
  const [notice, setNotice] = useState('');
  useEffect(() => { let cancelled = false; void shopRequest('catalog').then(data => { if (!cancelled && data.connected) setCatalog(data); }).catch(() => { /* Existing Converty links remain usable until the merchant connects. */ }); return () => { cancelled = true; }; }, []);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* The in-memory cart remains usable. */ } }, [cart]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  const setPending = useCallback((value: ShopContextValue['pending']) => { setPendingState(value); try { if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value)); else sessionStorage.removeItem(PENDING_KEY); } catch { /* No customer coordinates are saved in browser storage. */ } }, []);
  const add = (product: ShopProduct, variantId?: string, bundleId?: string, quantity = 1) => {
    setDetail(null);
    if (pending) { setOpened(true); return; }
    const maximum = Math.max(1, Math.floor(product.maxQuantity / (product.bundles.find(b => b.id === bundleId)?.quantity || 1)));
    const item = { productId: product.id, quantity: Math.max(1, Math.min(maximum, quantity)), ...(variantId ? { variantId } : {}), ...(bundleId ? { bundleId } : {}) };
    setCart(old => {
      const found = old.find(entry => lineKey(entry) === lineKey(item));
      if (found) return old.map(entry => entry === found ? { ...entry, quantity: Math.min(maximum, entry.quantity + item.quantity) } : entry);
      return old.length < 20 ? [...old, item] : old;
    });
    setNotice(`${product.name} a rejoint votre panier.`);
  };
  const change = (item: CartSelection, quantity: number) => { if (!pending) setCart(old => quantity <= 0 ? old.filter(entry => lineKey(entry) !== lineKey(item)) : old.map(entry => lineKey(entry) === lineKey(item) ? { ...entry, quantity: Math.min(50, quantity) } : entry)); };
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  return <ShopContext.Provider value={{ catalog, cart, count, open: () => { setDetail(null); setOpened(true); }, add, change, pending, view: (product, variantId, bundleId) => { setOpened(false); setDetail({ product, variantId, bundleId }); } }}>
    {children}
    {notice && <div className="shop-cart-toast" role="status"><CheckCircle2 size={19} />{notice}<button onClick={() => { setNotice(''); setOpened(true); }}>Voir le panier</button></div>}
    {opened && <BoutiqueCheckout onClose={() => setOpened(false)} setPending={setPending} clearCart={() => setCart([])} />}
    {detail && <BoutiqueProductDetails key={detail.product.id} {...detail} onClose={() => setDetail(null)} />}
  </ShopContext.Provider>;
}

export function BoutiqueLiveCollection({ fallback }: { fallback: ReactNode }) {
  const shop = useBoutique(); const [category, setCategory] = useState('Tout'); const [query, setQuery] = useState('');
  if (!shop.catalog) return fallback;
  const categories = [...new Set(shop.catalog.products.map(product => product.category))];
  const products = shop.catalog.products.filter(product => (category === 'Tout' || product.category === category) && product.name.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr')));
  return <section id="creations" className="boutique-creations boutique-section-anchor" aria-labelledby="boutique-creations-title">
    <div className="boutique-section-heading"><div><span className="boutique-eyebrow"><CakeSlice size={16} />LES ENVIES DE LA MAISON</span><h2 id="boutique-creations-title">À chaque envie,<br /><em>sa petite merveille.</em></h2><p>Choisissez vos douceurs, composez votre panier et laissez-nous préparer votre prochain petit bonheur.</p></div><button className="boutique-button boutique-button-light" onClick={shop.open}><ShoppingBag size={18} />Mon panier{shop.count > 0 && <span className="shop-count">{shop.count}</span>}</button></div>
    <div className="shop-collection-tools"><div className="boutique-category-tabs" aria-label="Filtrer les créations">{['Tout', ...categories].map(item => <button key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'Tout' ? 'Toutes les douceurs' : item}</button>)}</div><label className="shop-search"><Search size={18} /><input type="search" placeholder="Une envie, une saveur…" aria-label="Rechercher une création" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <p className="shop-results" aria-live="polite">{products.length} création{products.length > 1 ? 's' : ''} à savourer</p>
    <div className="boutique-product-grid">{products.map(product => <LiveProduct key={product.id} product={product} />)}</div>
    {!products.length && <div className="shop-empty"><CakeSlice size={34} /><h3>Une autre petite envie ?</h3><p>Aucune création ne correspond à cette recherche.</p><button className="boutique-button boutique-button-light" onClick={() => { setQuery(''); setCategory('Tout'); }}>Revoir toutes les douceurs</button></div>}
    <div className="boutique-all-creations"><p>Votre prochaine pause se prépare ici.</p><button className="boutique-button" onClick={shop.open}><ShoppingBag size={18} />Ouvrir mon panier{shop.count > 0 && ` (${shop.count})`}</button></div>
  </section>;
}
function LiveProduct({ product }: { product: ShopProduct }) {
  const shop = useBoutique(); const [variantId, setVariantId] = useState(product.variants.find(v => v.available)?.id || '');
  const variant = product.variants.find(v => v.id === variantId);
  const [bundleId, setBundleId] = useState(product.bundles.find(b => b.available)?.id || '');
  const bundle = product.bundles.find(b => b.id === bundleId);
  const available = product.available && (!product.variants.length || !!variant?.available) && (!product.bundles.length || !!bundle?.available);
  const view = () => shop.view(product, variantId, bundleId);
  return <article className="product-card boutique-product-card" onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input,select,label')) view(); }}><ProductArtwork product={shopArtwork(product)}><span className="product-category">{product.category}</span>{!available && <span className="shop-unavailable">De retour bientôt</span>}<button type="button" className="shop-product-open" aria-label={`Voir ${product.name}`} aria-haspopup="dialog" onClick={view}><span>Découvrir cette douceur</span></button></ProductArtwork><div className="boutique-product-copy"><span className="boutique-product-note">Une petite touche de bonheur</span><h3><button type="button" className="shop-product-title" onClick={view} aria-haspopup="dialog">{product.name}</button></h3><p>{product.description || 'Une création gourmande signée ARIMA.'}</p>
    {product.variants.length > 0 && <label className="shop-variant">Votre format<select value={variantId} onChange={e => setVariantId(e.target.value)} aria-label={`Format de ${product.name}`}>{product.variants.map(v => <option key={v.id} value={v.id} disabled={!v.available}>{v.label || 'Format individuel'}{!v.available ? ' · indisponible' : ''}</option>)}</select></label>}
    {product.bundles.length > 0 && <label className="shop-variant">Votre offre<select value={bundleId} onChange={e => setBundleId(e.target.value)} aria-label={`Offre de ${product.name}`}>{product.bundles.map(b => <option key={b.id} value={b.id} disabled={!b.available}>{b.quantity} pcs · {shopMoney(b.price)} · {b.label}</option>)}</select></label>}
    <div className="shop-product-price"><strong>{shopMoney(bundle?.price ?? variant?.price ?? product.price)}</strong>{!variant && !bundle && product.comparePrice !== undefined && product.comparePrice > product.price && <del>{shopMoney(product.comparePrice)}</del>}</div>
    {product.externalOnly ? <a className="boutique-product-order" href={`${official}/product/${encodeURIComponent(product.slug)}`}>Choisir les options sur la boutique</a> : <button className="boutique-product-order" disabled={!available} onClick={() => shop.add(product, variantId || undefined, bundleId || undefined)}><Plus size={17} />{available ? 'Ajouter une douceur' : 'De retour bientôt'}</button>}
  </div></article>;
}

function BoutiqueProductDetails({ product, variantId: initialVariant, bundleId: initialBundle, onClose }: { product: ShopProduct; variantId?: string; bundleId?: string; onClose: () => void }) {
  const shop = useBoutique(); const dialog = useRef<HTMLDialogElement>(null);
  const [variantId, setVariantId] = useState(initialVariant || product.variants.find(v => v.available)?.id || '');
  const [bundleId, setBundleId] = useState(initialBundle || product.bundles.find(b => b.available)?.id || '');
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find(v => v.id === variantId);
  const bundle = product.bundles.find(b => b.id === bundleId);
  const available = product.available && (!product.variants.length || !!variant?.available) && (!product.bundles.length || !!bundle?.available);
  const price = bundle?.price ?? variant?.price ?? product.price;
  const maximum = Math.max(1, Math.floor(product.maxQuantity / (bundle?.quantity || 1)));
  useEffect(() => {
    const element = dialog.current!; const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={dialog} className="shop-product-dialog" aria-labelledby="shop-product-detail-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="shop-product-detail-shell">
      <button type="button" className="shop-close shop-product-detail-close" aria-label="Fermer la fiche produit" onClick={onClose} autoFocus><X size={22} /></button>
      <div className="shop-product-detail-art"><ProductArtwork product={shopArtwork(product)}><span className="product-category">{product.category}</span></ProductArtwork><span className="shop-product-detail-caption"><Heart size={15} />Une cuillère de bonheur.</span></div>
      <div className="shop-product-detail-copy"><span className="boutique-eyebrow"><CakeSlice size={15} />LA TOUCHE ARIMA</span><h2 id="shop-product-detail-title">{product.name}</h2><p className="shop-product-detail-description">{product.description || 'Une création gourmande signée ARIMA, à savourer pour une petite pause tout en douceur.'}</p>
        {product.variants.length > 0 && <label className="shop-variant">Votre format<select value={variantId} onChange={e => { setVariantId(e.target.value); setQuantity(1); }} aria-label={`Format de ${product.name}`}>{product.variants.map(v => <option key={v.id} value={v.id} disabled={!v.available}>{v.label || 'Format individuel'}{!v.available ? ' · indisponible' : ''}</option>)}</select></label>}
        {product.bundles.length > 0 && <label className="shop-variant">Votre offre<select value={bundleId} onChange={e => { setBundleId(e.target.value); setQuantity(1); }} aria-label={`Offre de ${product.name}`}>{product.bundles.map(b => <option key={b.id} value={b.id} disabled={!b.available}>{b.quantity} pcs · {shopMoney(b.price)} · {b.label}</option>)}</select></label>}
        <div className="shop-product-price"><strong>{shopMoney(price)}</strong>{!variant && !bundle && product.comparePrice !== undefined && product.comparePrice > price && <del>{shopMoney(product.comparePrice)}</del>}{bundle && <span>le lot de {bundle.quantity} pièce{bundle.quantity > 1 ? 's' : ''}</span>}</div>
        {!product.externalOnly && available && <div className="shop-product-detail-quantity"><span>{bundle ? 'Nombre de lots' : 'Quantité'}</span><div className="shop-quantity"><button type="button" disabled={quantity <= 1} aria-label="Diminuer la quantité" onClick={() => setQuantity(q => q - 1)}><Minus size={16} /></button><output aria-live="polite" aria-label="Quantité sélectionnée">{quantity}</output><button type="button" disabled={quantity >= maximum} aria-label="Augmenter la quantité" onClick={() => setQuantity(q => q + 1)}><Plus size={16} /></button></div></div>}
        {product.externalOnly ? <a className="boutique-button shop-wide" href={`${official}/product/${encodeURIComponent(product.slug)}`}>Choisir les options sur la boutique</a> : <button type="button" className="boutique-button shop-wide shop-product-detail-add" disabled={!available} onClick={() => shop.add(product, variantId || undefined, bundleId || undefined, quantity)}><ShoppingBag size={18} />{!available ? 'De retour bientôt' : shop.pending ? 'Vérifier ma commande en cours' : `Ajouter au panier · ${shopMoney(price * quantity)}`}</button>}
        <p className="shop-product-detail-delivery">Livraison calculée dans votre panier. Paiement à la livraison.</p><button type="button" className="shop-back" onClick={onClose}>Continuer à découvrir les douceurs</button>
      </div>
    </div>
  </dialog>, document.body);
}

function BoutiqueCheckout({ onClose, setPending, clearCart }: { onClose: () => void; setPending: (value: ShopContextValue['pending']) => void; clearCart: () => void }) {
  const shop = useBoutique(); const dialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState<'cart' | 'details' | 'pending' | 'receipt'>(shop.pending ? 'pending' : 'cart');
  const [quote, setQuote] = useState<ShopQuote | null>(null); const [receipt, setReceipt] = useState<ShopReceipt | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [customer, setCustomer] = useState<ShopCustomer>({ name: '', phone: '', city: '', address: '', note: '' });
  const attempt = useRef(shop.pending?.attemptKey || crypto.randomUUID());
  const [canResume, setCanResume] = useState(false);
  useEffect(() => { const element = dialog.current!; const trigger = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; element.showModal(); document.body.style.overflow = 'hidden'; return () => { element.close(); document.body.style.overflow = overflow; trigger?.focus({ preventScroll: true }); }; }, []);
  const receive = (data: any) => {
    if (data.confirmed && data.receipt) { setReceipt(data.receipt); setPending(null); clearCart(); setStage('receipt'); setError(''); }
    else if (data.pending) setStage('pending');
  };
  const check = async () => {
    if (!shop.pending) return;
    setBusy(true); setError('');
    try { receive(await shopRequest('order-status', { attemptKey: shop.pending.attemptKey })); }
    catch (err) {
      if (err instanceof CheckoutError && err.code === 'ORDER_NOT_FOUND') { setCanResume(true); setError('La boutique n’a pas encore enregistré cette référence. Vous pouvez reprendre avec la même référence, sans créer de doublon.'); }
      else if (err instanceof CheckoutError && err.code === 'ORDER_REJECTED') { setPending(null); attempt.current = crypto.randomUUID(); setStage('cart'); setError(err.message); }
      else setError(err instanceof Error ? err.message : 'La vérification reprendra dans un instant.');
    } finally { setBusy(false); }
  };
  useEffect(() => { if (shop.pending) void check(); }, []);
  const items = shop.pending?.items || shop.cart;
  const quoteCart = async () => {
    setBusy(true); setError('');
    try { const result = await shopRequest('quote', { items }); setQuote(result); setStage('details'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Votre panier n’a pas pu être vérifié.'); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !quote) return;
    setBusy(true); setError(''); setPending({ attemptKey: attempt.current, items });
    try {
      receive(await shopRequest('orders', { attemptKey: attempt.current, quoteId: quote.id, items, customer }));
    } catch (err) {
      if (err instanceof CheckoutError && ['PRICE_CHANGED', 'QUOTE_EXPIRED', 'INVALID_CUSTOMER', 'INVALID_INPUT', 'OUT_OF_STOCK', 'PRODUCT_CHANGED', 'DELIVERY_REVIEW', 'INVALID_CART', 'INVALID_VARIANT', 'RATE_LIMIT', 'CONVERTY_NOT_CONNECTED', 'CONVERTY_UNAVAILABLE', 'ORIGIN', 'CART_SESSION'].includes(err.code || '')) {
        setPending(null); setError(err.message);
        if (err.code === 'PRICE_CHANGED' && err.details?.quote) setQuote(err.details.quote);
        else if (err.code !== 'INVALID_CUSTOMER' && err.code !== 'INVALID_INPUT') { setStage('cart'); setQuote(null); }
      } else if (err instanceof CheckoutError && err.code === 'ORDER_REJECTED') { setPending(null); attempt.current = crypto.randomUUID(); setStage('cart'); setError(err.message); }
      else { setStage('pending'); setError('La connexion a été interrompue pendant l’envoi. Vérifions la réception avant de recommencer.'); }
    } finally { setBusy(false); }
  };
  const currentTotal = shop.cart.reduce((sum, item) => { const product = shop.catalog?.products.find(p => p.id === item.productId); const variant = product?.variants.find(v => v.id === item.variantId); const bundle = product?.bundles.find(b => b.id === item.bundleId); return sum + (bundle?.price ?? variant?.price ?? product?.price ?? 0) * item.quantity; }, 0);
  return createPortal(<dialog ref={dialog} className="shop-checkout" aria-labelledby="shop-checkout-title" onCancel={event => { if (busy) event.preventDefault(); else { event.preventDefault(); onClose(); } }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="shop-checkout-shell"><header className="shop-checkout-heading"><div><span className="boutique-eyebrow"><Heart size={14} />LA TOUCHE ARIMA</span><h2 id="shop-checkout-title">{stage === 'receipt' ? 'Votre petit bonheur arrive.' : stage === 'pending' ? 'Un instant de douceur…' : stage === 'details' ? 'On vous garde une cuillère.' : 'Votre panier de douceurs.'}</h2></div><button className="shop-close" disabled={busy} aria-label="Fermer le panier" onClick={onClose}><X size={21} /></button></header>
    {stage !== 'receipt' && error && <div className="shop-checkout-error" role="alert">{error}</div>}
    {stage === 'cart' && <>{!shop.cart.length ? <div className="shop-empty"><AtelierArt compact /><h3>Il manque une petite douceur.</h3><p>Votre panier attend ses premières gourmandises.</p><button className="boutique-button" onClick={onClose}>Découvrir les créations</button></div> : <><div className="shop-cart-lines">{shop.cart.map(item => {
      const product = shop.catalog?.products.find(p => p.id === item.productId); const variant = product?.variants.find(v => v.id === item.variantId); const bundle = product?.bundles.find(b => b.id === item.bundleId);
      return <article key={lineKey(item)} className="shop-cart-line">{product && <img src={product.image} alt="" />}<div><h3>{product?.name || 'Création indisponible'}</h3>{variant && <p>{variant.label}</p>}{bundle && <p>{bundle.quantity} pcs · {bundle.label}</p>}<span>{shopMoney((bundle?.price ?? variant?.price ?? product?.price ?? 0) * item.quantity)}</span><div className="shop-quantity"><button disabled={busy || !!shop.pending || item.quantity <= 1} aria-label={`Diminuer ${product?.name || 'la quantité'}`} onClick={() => shop.change(item, item.quantity - 1)}><Minus size={15} /></button><span aria-label="Quantité">{item.quantity}</span><button disabled={busy || !!shop.pending || item.quantity >= Math.floor((product?.maxQuantity || 50) / (bundle?.quantity || 1))} aria-label={`Augmenter ${product?.name || 'la quantité'}`} onClick={() => shop.change(item, item.quantity + 1)}><Plus size={15} /></button></div></div><button className="shop-remove" disabled={busy || !!shop.pending} aria-label={`Retirer ${product?.name || 'la création'}`} onClick={() => shop.change(item, 0)}><Trash2 size={17} /></button></article>;
    })}</div><div className="shop-summary"><div><span>Vos douceurs</span><strong>{shopMoney(currentTotal)}</strong></div><p>Les frais de livraison et les éventuelles remises sont précisés à l’étape suivante.</p></div><button className="boutique-button shop-wide" disabled={busy} onClick={quoteCart}>{busy ? <LoaderCircle className="shop-spin" size={18} /> : <ShoppingBag size={18} />}{busy ? 'Un instant…' : 'Continuer ma commande'}</button></> }</>}
    {stage === 'details' && quote && <form className="shop-delivery-form" onSubmit={submit}><button className="shop-back" type="button" disabled={busy || !!shop.pending} onClick={() => { setStage('cart'); setQuote(null); }}>Modifier mon panier</button><div className="shop-delivery-grid"><label>Votre nom<input required maxLength={200} autoComplete="name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} disabled={busy} /></label><label>Téléphone<input required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="Votre numéro à 8 chiffres" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} disabled={busy} /></label><label>Ville{shop.catalog?.cities.length ? <select required value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} disabled={busy}><option value="">Choisir ma ville</option>{shop.catalog.cities.map(city => <option key={city}>{city}</option>)}</select> : <input required autoComplete="address-level1" maxLength={100} value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} disabled={busy} />}</label><label>Adresse de livraison<input required autoComplete="street-address" maxLength={500} value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} disabled={busy} /></label><label className="shop-wide-field">Email <small>facultatif</small><input type="email" autoComplete="email" maxLength={200} value={customer.email || ""} onChange={e => setCustomer({ ...customer, email: e.target.value })} disabled={busy} /></label><label className="shop-wide-field">Une petite précision ? <small>facultatif</small><textarea maxLength={1000} rows={2} value={customer.note} onChange={e => setCustomer({ ...customer, note: e.target.value })} disabled={busy} placeholder="Un repère pour la livraison…" /></label></div><div className="shop-summary"><div><span>Vos douceurs</span><strong>{shopMoney(quote.subtotal)}</strong></div><div><span>Livraison</span><strong>{quote.delivery === 0 ? 'Offerte' : shopMoney(quote.delivery)}</strong></div><div className="shop-summary-total"><span>Total de votre commande</span><strong>{shopMoney(quote.total)}</strong></div></div><p className="shop-payment-note">Paiement à la livraison.</p><button className="boutique-button shop-wide" disabled={busy} type="submit">{busy ? <LoaderCircle className="shop-spin" size={18} /> : <Heart size={18} />}{busy ? 'Votre commande se prépare…' : `Confirmer ma commande · ${shopMoney(quote.total)}`}</button><p className="shop-privacy">Vos coordonnées sont transmises à ARIMA et à Converty pour préparer et suivre votre commande.</p></form>}
    {stage === 'pending' && <div className="shop-pending"><AtelierArt compact /><h3>Vérifions votre commande.</h3><p>Gardez cette référence : <strong className="shop-web-reference">{shop.pending?.attemptKey || attempt.current}</strong></p><p>Vérifiez sa réception avant de passer une nouvelle commande.</p><button className="boutique-button shop-wide" disabled={busy} onClick={check}><RefreshCw size={18} className={busy ? 'shop-spin' : ''} />Vérifier la réception</button>{canResume && <button className="shop-back" disabled={busy} onClick={quoteCart}>Reprendre avec la même référence</button>}<a href="https://www.instagram.com/arima_tn/" target="_blank" rel="noreferrer">Contacter ARIMA</a></div>}
    {stage === 'receipt' && receipt && <article className="shop-receipt print-card"><div className="shop-receipt-confetti" aria-hidden="true">✧<Heart />✧<CakeSlice />✧</div><BrandLogo /><div className="shop-receipt-check"><Check size={29} /></div><h3>Merci pour votre commande !</h3><p>Elle a bien été reçue par ARIMA.</p><strong className="shop-receipt-number">Commande n° {receipt.reference}</strong><div className="shop-receipt-items">{receipt.items.map(item => <div key={lineKey(item)}><span>{item.quantity} × {item.name}{item.variantLabel && <small>{item.variantLabel}</small>}</span><strong>{shopMoney(item.total)}</strong></div>)}</div><div className="shop-summary"><div><span>Livraison</span><strong>{shopMoney(receipt.delivery)}</strong></div><div className="shop-summary-total"><span>Total · à régler à la livraison</span><strong>{shopMoney(receipt.total)}</strong></div></div><p className="shop-receipt-thanks">Une petite pause. Beaucoup de bonheur.</p><div className="shop-receipt-actions no-print"><button className="boutique-button boutique-button-light" onClick={() => window.print()}><Printer size={17} />Imprimer le récapitulatif</button><button className="shop-back" onClick={onClose}>Continuer la visite</button></div></article>}
    {busy && <p className="shop-busy-note" role="status"><Heart size={14} />Un petit bonheur se prépare…</p>}
    {stage !== 'receipt' && !busy && <p className="shop-official-link"><a href={`${official}/search`}>Retrouver aussi la boutique Converty</a></p>}
    </div>
  </dialog>, document.body);
}
