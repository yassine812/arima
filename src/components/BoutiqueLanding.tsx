import { useEffect, useState } from 'react';
import { CakeSlice, Coffee, Film, Heart, Menu, ShoppingBag, Sparkles, X } from 'lucide-react';
import BrandLogo from './BrandLogo';
import AtelierArt from './AtelierArt';
import { AtelierMotion } from './AtelierMotion';
import CafeCinema from './CafeCinema';
import ProductArtwork from './ProductArtwork';
import { BoutiqueProvider, BoutiqueLiveCollection, useBoutique } from './BoutiqueCommerce';
import { storefrontFallbackPhotos } from '../storefrontPhotos';
import type { Product } from '../types';
import '../boutique-landing.css';

const shop = 'https://arima.converty.shop';
const creations = [
  { id: 'cheese_fraise', name: 'Cheesecake Fraise', category: 'Cheesecakes', description: 'La petite pause fruitée. Une crème douce, une touche de fraise et beaucoup de gourmandise.', slug: 'cheesecake-fraise', note: 'Une envie de fraise ?' },
  { id: 'tira_pistache', name: 'Tiramisu Pistache', category: 'Tiramisus', description: 'Des couches généreuses, une crème onctueuse et la touche pistache qui fait tout.', slug: 'tiramisu-pistache', note: 'Le petit cœur vert' },
  { id: 'tira_classique', name: 'Tiramisu Classique', category: 'Tiramisus', description: 'Le plaisir du café et du cacao, à savourer tranquillement, une cuillère après l’autre.', slug: 'tiramisu-classique', note: 'Tout simplement gourmand' },
  { id: 'tira_speculos', name: 'Tiramisu Spéculoos', category: 'Tiramisus', description: 'Le biscuit épicé rencontre la douceur de la crème. Une jolie excuse pour une pause.', slug: 'tiramisu-speculoos', note: 'Pour les amoureux du biscuit' },
  { id: 'cheese_rafaello', name: 'Cheesecake Raffaello', category: 'Cheesecakes', description: 'Une douceur crémeuse et une touche de noix de coco pour les envies délicates.', slug: 'cheesecake-raffaello', note: 'Un petit nuage' },
  { id: 'cheese_chocolat', name: 'Cheesecake Chocolat', category: 'Cheesecakes', description: 'Le rendez-vous des envies chocolatées. Retrouvez toute la collection sur la boutique.', href: '/category/cheesecake', note: 'La touche chocolat' },
];

function Scribble({ className = '' }: { className?: string }) {
  return <svg className={`boutique-scribble ${className}`} viewBox="0 0 140 100" fill="none" aria-hidden="true"><path d="M8 10C73-8 106 26 75 46C42 66 34 30 65 33C106 35 121 58 118 87M103 72L118 90L132 72" /></svg>;
}

export default function BoutiqueLanding() {
  return <BoutiqueProvider><BoutiqueContent /></BoutiqueProvider>;
}
function BoutiqueContent() {
  const commerce = useBoutique();
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState('Tout');
  useEffect(() => {
    document.title = 'ARIMA — Un peu de douceur, beaucoup de bonheur';
    const description = document.querySelector('meta[name="description"]');
    const previous = description?.getAttribute('content');
    description?.setAttribute('content', 'Les tiramisus et cheesecakes ARIMA en images et en vidéos. Découvrez nos créations gourmandes et commandez sur notre boutique.');
    return () => { if (previous) description?.setAttribute('content', previous); };
  }, []);
  const explore = () => document.getElementById('creations')?.scrollIntoView({ behavior: 'smooth' });

  return <div className="boutique-landing">
    <a className="boutique-skip" href="#boutique-contenu">Aller au contenu</a>
    <div className="boutique-announcement"><Sparkles size={14} /><span>Les petits bonheurs ont une adresse. Bienvenue chez ARIMA.</span><Heart size={14} /></div>
    <header className="boutique-header">
      <a className="brand-home" href="#" aria-label="ARIMA, accueil"><BrandLogo /></a>
      <button className="boutique-menu-toggle" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} aria-controls="boutique-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav id="boutique-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Navigation principale" onClick={() => setMenuOpen(false)}>
        <a href="#videos"><Film size={16} />Nos petites vidéos</a><a href="#creations"><CakeSlice size={16} />Les créations</a><a href="#comment-commander">Comment commander</a>
        {(commerce.catalog || commerce.pending) ? <button className="boutique-button" onClick={commerce.open}><ShoppingBag size={17} />Mon panier <span className="shop-count">{commerce.count}</span></button> : <a className="boutique-button" href={`${shop}/search`}><ShoppingBag size={17} />Commander</a>}
      </nav>
    </header>

    <AtelierMotion viewKey="boutique">
      <div id="boutique-contenu">
        <section className="boutique-hero" aria-labelledby="boutique-title">
          <div className="boutique-hero-copy">
            <span className="boutique-eyebrow"><Heart size={15} />LA TOUCHE ARIMA</span>
            <h1 id="boutique-title">Un peu de douceur,<br /><em>beaucoup de<br className="boutique-desktop-break" /> bonheur.</em><svg viewBox="0 0 440 24" aria-hidden="true"><path d="M6 14Q195-2 431 12M42 23Q206 7 398 18" /></svg></h1>
            <p>Des tiramisus, des cheesecakes et ces petites bouchées qui font sourire. Installez-vous, on vous garde une cuillère.</p>
            <div className="boutique-hero-actions"><a className="boutique-button" href="#creations"><ShoppingBag size={18} />Choisir mes douceurs</a><a className="boutique-button boutique-button-light" href="#videos"><Film size={18} />Voir les vidéos</a></div>
            <div className="boutique-hero-note"><span>Fait pour les petits moments heureux.</span><Scribble /></div>
          </div>
          <div className="boutique-hero-art" aria-hidden="true">
            <span className="boutique-art-halo" /><AtelierArt />
            <span className="boutique-art-label boutique-label-rose"><Heart size={15} />Une cuillère de bonheur</span>
            <span className="boutique-art-label boutique-label-green"><Coffee size={17} />Ça va si bien avec un café…</span>
            <span className="boutique-art-spark">✧</span><span className="boutique-art-spark boutique-art-spark-small">✧</span>
          </div>
        </section>

        <div className="boutique-flavour-ribbon" aria-label="Les douceurs ARIMA"><span>Un nuage de crème</span><Heart size={16} /><span>La pause qu’on aime</span><Sparkles size={17} /><span>À savourer ensemble</span></div>

        <div id="videos" className="boutique-section-anchor"><CafeCinema onExplore={explore} /></div>

        <BoutiqueLiveCollection fallback={<section id="creations" className="boutique-creations boutique-section-anchor" aria-labelledby="boutique-creations-title">
          <div className="boutique-section-heading"><div><span className="boutique-eyebrow"><CakeSlice size={16} />LES ENVIES DE LA MAISON</span><h2 id="boutique-creations-title">À chaque envie,<br /><em>sa petite merveille.</em></h2><p>Choisissez votre coup de cœur. Retrouvez les formats, les prix et les options disponibles sur notre boutique.</p></div><span className="boutique-heading-note" aria-hidden="true">Psst…<br />ça donne envie !<Scribble /></span></div>
          <div className="boutique-category-tabs" aria-label="Filtrer les créations">{['Tout', 'Tiramisus', 'Cheesecakes'].map(item => <button key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'Tout' ? 'Toutes les douceurs' : item}</button>)}</div>
          <div className="boutique-product-grid">{creations.filter(item => category === 'Tout' || item.category === category).map(item => {
            const product: Product = { ...item, price: 0, image: storefrontFallbackPhotos[item.id] };
            return <article key={item.id} className="product-card boutique-product-card"><ProductArtwork product={product}><span className="product-category">{item.category}</span></ProductArtwork><div className="boutique-product-copy"><span className="boutique-product-note">{item.note}</span><h3>{item.name}</h3><p>{item.description}</p><a className="boutique-product-order" href={`${shop}${'href' in item && item.href ? item.href : `/product/${item.slug}`}`}><ShoppingBag size={17} />{'href' in item && item.href ? 'Découvrir les cheesecakes' : 'Voir et commander'}</a></div></article>;
          })}</div>
          <div className="boutique-all-creations"><p>Plutôt une box à partager ou une autre saveur ?</p><a className="boutique-button" href={`${shop}/search`}><CakeSlice size={18} />Voir toute la collection</a></div>
        </section>} />

        <section className="boutique-sharing" aria-labelledby="boutique-sharing-title" data-atelier-reveal>
          <div className="boutique-sharing-illustration" aria-hidden="true"><img src="/brand/motion/tiramisu.svg" alt="" /><Heart /><img src="/brand/motion/cheesecake.svg" alt="" /></div>
          <div><span className="boutique-eyebrow">LES JOIES QUI SE PARTAGENT</span><h2 id="boutique-sharing-title">Un pour toi.<br /><em>Un pour moi.</em></h2><p>Impossible de choisir ? Retrouvez nos box gourmandes et offrez-vous une dégustation à plusieurs.</p><a className="boutique-button" href={commerce.catalog ? "#creations" : `${shop}/category/box-gourmande`}><Heart size={18} />Découvrir les box gourmandes</a></div>
        </section>

        <section id="comment-commander" className="boutique-how boutique-section-anchor" aria-labelledby="boutique-how-title"><span className="boutique-eyebrow"><ShoppingBag size={16} />VOTRE PROCHAINE PAUSE</span><h2 id="boutique-how-title">Quelques clics.<br /><em>Puis, la gourmandise.</em></h2><div className="boutique-how-grid"><article><CakeSlice /><h3>Une envie</h3><p>Explorez les créations et trouvez la saveur qui vous fait sourire.</p></article><article><ShoppingBag /><h3>Votre sélection</h3><p>Choisissez vos formats et ajoutez vos douceurs préférées au panier.</p></article><article><Heart /><h3>Le petit bonheur</h3><p>Renseignez vos coordonnées, vérifiez le total et validez votre commande.</p></article></div><a className="boutique-button" href={commerce.catalog ? "#creations" : `${shop}/search`}>C’est l’heure de la pause</a></section>

        <section className="boutique-questions" aria-labelledby="boutique-questions-title"><h2 id="boutique-questions-title">Une petite question ?</h2><details><summary>Où retrouver les prix et les formats ?</summary><p>Sur chaque fiche de notre collection, avec les formats et les options disponibles. Choisissez votre douceur pour composer votre panier.</p></details><details><summary>Comment connaître le total de ma commande ?</summary><p>Le récapitulatif affiche vos douceurs, les frais de livraison et le total avant votre confirmation.</p></details><details><summary>Peut-on choisir plusieurs saveurs ?</summary><p>Oui : ajoutez vos créations préférées au panier, ou découvrez les box dans la collection Box Gourmande.</p></details></section>
      </div>
    </AtelierMotion>
    <footer className="boutique-footer"><BrandLogo /><p>La touche ARIMA.<br /><em>Les petits bonheurs, tout simplement.</em></p><div><a href="https://www.instagram.com/arima_tn/" target="_blank" rel="noreferrer">Instagram</a><a href="#creations">La boutique</a><a href="/espace">Espace café partenaire</a></div><small>© {new Date().getFullYear()} ARIMA · Tiramisu & Cheesecake</small></footer>
    {(commerce.catalog || commerce.pending) ? <button className="boutique-mobile-order" onClick={commerce.open}><ShoppingBag size={18} />Mon panier de douceurs <span className="shop-count">{commerce.count}</span></button> : <a className="boutique-mobile-order" href={`${shop}/search`}><ShoppingBag size={18} />Choisir mes douceurs</a>}
  </div>;
}
