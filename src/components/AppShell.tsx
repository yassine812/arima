import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutDashboard, ReceiptText, CakeSlice, Coffee, ShoppingBag, Plus, Bell, LogOut, Menu, X, ChevronRight, ChevronDown, RefreshCw, ArrowUpRight, Sparkles, Heart, BookOpen, Ticket, Film } from 'lucide-react';
import BrandLogo from './BrandLogo';
import AtelierArt from './AtelierArt';
import { AtelierMotion } from './AtelierMotion';
import type { AppNotification } from '../types';

interface Props {
  children: ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  user: { name: string; role: string };
  notifications: AppNotification[];
  onReadNotification: (id: string) => Promise<void>;
  onLogout: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  loading: boolean;
}
const items = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'invoices', label: 'Factures', icon: ReceiptText },
  { id: 'orders', label: 'Commandes', icon: ShoppingBag },
  { id: 'products', label: 'Nos créations', icon: CakeSlice, admin: true },
  { id: 'catalogue', label: 'Catalogue', icon: BookOpen },
  { id: 'videos', label: 'Vidéos', icon: Film, admin: true },
  { id: 'tickets', label: 'Tickets', icon: Ticket, admin: true },
  { id: 'cafes', label: 'Cafés partenaires', icon: Coffee, admin: true },
];
const titles: Record<string, string> = { dashboard: 'Vue d’ensemble', invoices: 'Factures', orders: 'Commandes', products: 'Nos créations', catalogue: 'Catalogue', videos: 'Vidéos', tickets: 'Tickets', cafes: 'Cafés partenaires', 'create-invoice': 'Nouvelle facture', 'view-invoice': 'Détail de la facture', 'create-order': 'Nouvelle commande' };
const cafeItems = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'products', label: 'Les produits', icon: CakeSlice },
  { id: 'orders', label: 'Mes commandes', icon: ShoppingBag },
  { id: 'catalogue', label: 'Catalogues', icon: BookOpen },
  { id: 'invoices', label: 'Mes factures', icon: ReceiptText },
];

export default function AppShell({ children, activeView, onNavigate, user, notifications, onReadNotification, onLogout, onCreate, onRefresh, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const unread = notifications.filter(n => !n.read).length;
  const isCafe = user.role === 'cafe';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const change = () => { setIsMobile(media.matches); if (!media.matches) setOpen(false); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = old; window.removeEventListener('keydown', close); menuRef.current?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!showNotifications) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowNotifications(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showNotifications]);
  useEffect(() => {
    if (!showProfile) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setShowProfile(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setShowProfile(false); profileButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [showProfile]);
  const navigate = (view: string) => { onNavigate(view); setOpen(false); setShowNotifications(false); setShowProfile(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const mobileItems = isCafe ? cafeItems : items.filter(item => ['dashboard', 'invoices', 'orders', 'products'].includes(item.id));
  return <div className="app-shell" data-view={activeView} data-role={user.role}>
    <a className="skip-link" href="#atelier-main">Aller au contenu</a>
    {open && <button className="sidebar-overlay no-print" aria-label="Fermer le menu" onClick={() => setOpen(false)} />}
    <aside ref={sidebarRef} inert={isMobile && !open ? true : undefined} aria-hidden={isMobile && !open ? true : undefined} className={`sidebar no-print ${open ? 'is-open' : ''}`} aria-label="Navigation principale" onKeyDown={event => {
      if (!open || event.key !== 'Tab') return;
      const buttons = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className="sidebar-brand"><button className="brand-home" onClick={() => navigate('dashboard')} aria-label="ARIMA — accueil"><BrandLogo /></button><span className="brand-caption">L’ART DE BIEN RECEVOIR</span><button className="sidebar-close icon-button" aria-label="Fermer le menu" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <div className="sidebar-section-label">{isCafe ? 'MON ESPACE CAFÉ' : 'VOTRE ATELIER'}</div>
      <nav className="sidebar-nav">{(isCafe ? cafeItems : items).map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${activeView === id || (id === 'invoices' && activeView.includes('invoice')) || (id === 'orders' && activeView === 'create-order') ? 'is-active' : ''}`} aria-current={activeView === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.6} /><span>{label}</span><ChevronRight size={14} className="nav-chevron" /></button>)}</nav>
      <div className="sidebar-note"><AtelierArt compact /><p>Un petit bonheur,<br /><em>chaque jour.</em></p><span>L’ATELIER ARIMA</span></div>
      <div className="sidebar-bottom"><div className="connection-status"><span /> Session active</div><button onClick={onLogout} className="logout-button"><LogOut size={17} /> Se déconnecter <ArrowUpRight size={15} /></button></div>
    </aside>
    <div className="main-workspace" inert={isMobile && open ? true : undefined} aria-hidden={isMobile && open ? true : undefined}>
      <header className="workspace-topbar no-print">
        <div className="topbar-location"><button ref={menuRef} className="icon-button mobile-menu-toggle" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} /></button><BrandLogo mark className="mobile-brand" /><span className="breadcrumb-maison">Maison ARIMA</span><ChevronRight size={13} className="breadcrumb-chevron" /><span className="breadcrumb-page">{(isCafe && cafeItems.find(item => item.id === activeView)?.label) || titles[activeView]}</span></div>
        <div className="topbar-actions"><button className={`icon-button refresh-button ${loading ? 'is-refreshing' : ''}`} aria-label="Actualiser les données" title="Actualiser" onClick={onRefresh} disabled={loading}><RefreshCw size={17} /></button>
          <div className="notifications-wrap"><button className={`icon-button ${showNotifications ? 'is-selected' : ''}`} aria-label={`Notifications${unread ? `, ${unread} non lue${unread > 1 ? "s" : ""}` : ''}`} aria-expanded={showNotifications} onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}><Bell size={19} />{unread > 0 && <span className="notification-dot" />}</button>
            {showNotifications && <><button className="popover-dismiss" aria-label="Fermer les notifications" onClick={() => setShowNotifications(false)} /><div className="notification-popover"><div className="popover-heading"><h2>Notifications</h2><span>{unread} non lue{unread > 1 ? 's' : ''}</span></div><div className="notification-list">{notifications.length === 0 ? <p className="empty-copy">Vous êtes à jour. Aucune notification.</p> : [...notifications].reverse().map(n => <button key={n.id} className={`notification-item ${n.read ? '' : 'is-unread'}`} onClick={() => onReadNotification(n.id)}><span className="notification-item-top"><strong>{n.title}</strong><time>{new Date(n.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</time></span><span>{n.message}</span></button>)}</div></div></>}
          </div>
          <div className="profile-wrap" ref={profileRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowProfile(false); }}>
            <button type="button" ref={profileButtonRef} className="topbar-user profile-toggle" aria-label="Ouvrir le menu du compte" aria-expanded={showProfile} aria-controls="profile-popover" onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}>
              <span className="user-avatar">{isCafe ? <Coffee size={19} /> : user.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>
              <span className="profile-copy"><strong>{isCafe ? user.name : 'Administration'}</strong><span>{isCafe ? 'Café partenaire' : 'Maison ARIMA'}</span></span>
              <ChevronDown size={14} className="profile-chevron" aria-hidden="true" />
            </button>
            {showProfile && <div id="profile-popover" className="profile-popover" role="region" aria-label="Mon compte">
              <div className="profile-identity"><strong>{isCafe ? user.name : 'Administration'}</strong><span>{isCafe ? 'Espace Café partenaire' : 'Maison ARIMA · Administration'}</span></div>
              <button type="button" className="profile-logout" onClick={() => { setShowProfile(false); onLogout(); }}><LogOut size={18} /><span>Se déconnecter</span><ArrowUpRight size={15} /></button>
            </div>}
          </div>
        </div>
      </header>
      <div className="workspace-content"><div className="workspace-context no-print"><span className="atelier-greeting"><Sparkles size={15} />{isCafe ? 'Une pause gourmande commence ici.' : 'Un peu de douceur, beaucoup de soin.'}</span><button className="btn-primary context-create" onClick={onCreate}><Plus size={17} />{isCafe ? 'Passer une commande' : 'Nouvelle facture'}</button></div><AtelierMotion viewKey={activeView}>{children}</AtelierMotion></div>
      <footer className="workspace-footer no-print"><span>© {new Date().getFullYear()} Maison ARIMA</span><span><Heart size={12} /> Le cœur à l’ouvrage.</span><span>Pâtisserie artisanale · Tunisie</span></footer>
    </div>
    <nav className="mobile-tabbar no-print" aria-label="Navigation mobile" inert={open ? true : undefined} aria-hidden={open ? true : undefined}>
      {mobileItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} aria-current={activeView === id || (id === 'invoices' && activeView.includes('invoice')) || (id === 'orders' && activeView === 'create-order') ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} strokeWidth={1.7} /><span>{id === 'dashboard' ? 'Accueil' : id === 'products' ? 'Produits' : id === 'orders' ? 'Commandes' : id === 'catalogue' ? 'Catalogue' : 'Factures'}</span></button>)}
      {!isCafe && <button type="button" aria-label="Tous les menus" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} /><span>Menu</span></button>}
    </nav>
  </div>;
}
