import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, X, ArrowUpRight, CakeSlice, Pencil, Trash2, Check, Layers3, CupSoda, Grid2X2 } from 'lucide-react';
import type { Cafe, Product } from '../types';
import ProductArtwork from './ProductArtwork';
import AtelierHero from './AtelierHero';
import ProductCafePrices from './ProductCafePrices';

interface Props {
  products: Product[];
  cafes: Cafe[];
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onEditProduct: (id: string, product: Omit<Product, 'id'>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}
const empty = { name: '', price: '', category: 'Cheesecakes', description: '', image: '' };
const categoryOrder = ['Cheesecakes', 'Tiramisus', 'Mini tiramisus'];
function CategoryIcon({ category }: { category?: string }) {
  const Icon = !category ? Layers3 : category === 'Mini tiramisus' ? Grid2X2 : category === 'Cheesecakes' ? CakeSlice : CupSoda;
  return <Icon size={17} strokeWidth={1.7} aria-hidden="true" />;
}
export default function ProductCatalogView({ products, cafes, onAddProduct, onEditProduct, onDeleteProduct }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sortedCafes = useMemo(() => [...cafes].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [cafes]);
  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort((a, b) => (categoryOrder.includes(a) ? categoryOrder.indexOf(a) : 99) - (categoryOrder.includes(b) ? categoryOrder.indexOf(b) : 99) || a.localeCompare(b, 'fr')), [products]);
  const filtered = products.filter(p => (filter === 'all' || p.category === filter) && (p.name + ' ' + p.description + ' ' + p.category).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  function openEditor(product?: Product) {
    setEditor(product || 'new');
    setForm(product ? { name: product.name, price: String(product.price), category: product.category, description: product.description || '', image: product.image === 'photo_pending' ? '' : product.image || '' } : empty);
    setError(''); setSuccess('');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) { setError('Veuillez vérifier le nom et le prix.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, price };
      if (editor && editor !== 'new') await onEditProduct(editor.id, payload);
      else await onAddProduct(payload);
      setSuccess(editor === 'new' ? 'Votre création a été ajoutée au catalogue.' : 'Votre création a été mise à jour.');
      setEditor(null);
    } catch (err: any) { setError(err.message || 'La sauvegarde a échoué.'); }
    finally { setSaving(false); }
  }
  return <div className="catalog-page">
    <AtelierHero kind="rose" eyebrow="LA COLLECTION ARIMA" title={<>Nos petites <em>merveilles.</em></>} description="Un nuage de crème, une touche de bonheur. Retrouvez toutes vos créations."><button className="btn-primary" onClick={() => openEditor()}><Plus size={17} />Ajouter une création</button></AtelierHero>
    {success && <div className="success-banner" role="status"><Check size={17} />{success}<button aria-label="Fermer la confirmation" onClick={() => setSuccess('')}><X size={16} /></button></div>}
    {editor && <form className="surface product-editor" onSubmit={save}><div className="panel-heading"><div><span className="section-eyebrow">L’ATELIER</span><h2>{editor === 'new' ? 'Une nouvelle création' : 'Le soin des détails'}</h2></div><button type="button" className="icon-button" aria-label="Fermer le formulaire" onClick={() => setEditor(null)} disabled={saving}><X size={20} /></button></div><div className="product-form-grid"><div className="form-field"><label htmlFor="product-name">Nom de la création</label><input autoFocus id="product-name" required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. Cheesecake pistache" /></div><div className="form-field"><label htmlFor="product-price">Prix catalogue · DT</label><input id="product-price" type="number" min="0" step="0.001" max="1000000" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0,000" /></div><div className="form-field"><label htmlFor="product-category">Famille de saveurs</label><input id="product-category" required list="product-categories" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><datalist id="product-categories">{[...new Set([...categories, 'Cheesecakes', 'Tiramisus', 'Traditionnel'])].map(c => <option key={c} value={c} />)}</datalist></div><div className="form-field"><label htmlFor="product-image">Lien de la photo <span>· facultatif</span></label><input id="product-image" value={form.image === 'cake' ? '' : form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" /></div><div className="form-field form-field-wide"><label htmlFor="product-description">Quelques mots sur votre création</label><textarea id="product-description" rows={2} maxLength={4000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Les saveurs, la texture, la petite touche ARIMA…" /></div></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="editor-actions"><button type="button" className="btn-secondary" onClick={() => setEditor(null)} disabled={saving}>Annuler</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la création'}<Check size={16} /></button></div></form>}
    <div className="catalog-toolbar"><div className="category-tabs" aria-label="Familles de pâtisseries"><button aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><CategoryIcon />Tout<span>{products.length}</span></button>{categories.map(category => <button key={category} aria-pressed={filter === category} className={filter === category ? 'is-active' : ''} onClick={() => setFilter(category)}><CategoryIcon category={category} />{category}<span>{products.filter(p => p.category === category).length}</span></button>)}</div><label className="catalog-search"><Search size={17} /><span className="sr-only">Rechercher une création</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une création…" /></label></div>
    <div className="catalog-results"><span>{filtered.length} création{filtered.length !== 1 ? 's' : ''}</span><span>PRIX CATALOGUE · DINAR TUNISIEN</span></div>
    <div className="product-grid">{filtered.map(product => {
      return <article key={product.id} className="product-card"><ProductArtwork product={product}><span className="product-category">{product.category}</span><button className="product-edit" onClick={() => openEditor(product)} aria-label={'Modifier ' + product.name}><Pencil size={15} /></button></ProductArtwork><div className="product-body"><h2>{product.name}</h2><p>{product.description || 'Une création signée Maison ARIMA.'}</p><div className="product-card-footer"><span className="product-price">{product.price.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}<small>DT</small></span><button className="product-delete" title="Retirer du catalogue" aria-label={'Supprimer ' + product.name} onClick={() => { if (window.confirm('Retirer « ' + product.name + ' » du catalogue ? Les factures existantes seront conservées.')) onDeleteProduct(product.id); }}><Trash2 size={15} /></button></div><ProductCafePrices product={product} cafes={sortedCafes} /></div></article>;
    })}</div>
    {filtered.length === 0 && <div className="empty-state surface"><Search size={30} /><h2>Aucune création trouvée.</h2><p>Essayez un autre nom ou une autre famille.</p><button className="btn-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Voir toutes les créations<ArrowUpRight size={16} /></button></div>}
  </div>;
}

