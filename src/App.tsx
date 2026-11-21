/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from 'react-dom';
import { AlertCircle, Check, X, BellRing } from "lucide-react";
import AppShell from "./components/AppShell";
import BrandLogo from "./components/BrandLogo";
import { Product, Invoice, DashboardStats, Cafe, Order, OrderStatus, AppNotification, OrderSubmissionResult } from "./types";
import OrderReceiptCelebration from './components/OrderReceiptCelebration';
import DashboardView from "./components/DashboardView";
import CafeDashboardView from "./components/CafeDashboardView";
import CafeCinema from "./components/CafeCinema";
import ProductCatalogView from "./components/ProductCatalogView";
import CafeProductsView from "./components/CafeProductsView";
import CatalogueBookView from "./components/CatalogueBookView";
import TicketsView from "./components/TicketsView";
import InvoiceCreateEditView from "./components/InvoiceCreateEditView";
import InvoiceListView from "./components/InvoiceListView";
import InvoiceDetailPrintView from "./components/InvoiceDetailPrintView";
import AdminLoginView from "./components/AdminLoginView";
import CafeManagementView from "./components/CafeManagementView";
import OrdersListView from "./components/OrdersListView";
import OrderCreateView from "./components/OrderCreateView";

type Tab = "dashboard" | "invoices" | "products" | "catalogue" | "videos" | "tickets" | "create-invoice" | "view-invoice" | "cafes" | "orders" | "create-order";

export default function App() {
  // Session credentials live in an HttpOnly cookie; this is only a UI marker.
  const [token, setToken] = useState<string | null>("session");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // Current session user context state
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);

  // Core Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  // UI states

  // Café Pricing State Selection
  const [selectedCafeId, setSelectedCafeId] = useState("all");

  // Editing state placeholders
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<Invoice | null>(null);
  const [orderProductId, setOrderProductId] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<string | null>(null);
  const [orderReceipt, setOrderReceipt] = useState<{ order: Order; invoice: Invoice } | null>(null);
  const [activity, setActivity] = useState<AppNotification | null>(null);
  const seenNotifications = useRef(new Set<string>());
  const notificationsReady = useRef(false);

  // Global loading and error indicators
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear session logout helper
  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* The next session check will retry when online. */ }
    localStorage.removeItem("arima_token");
    setToken(null);
    setCurrentUser(null);
    setProducts([]);
    setCafes([]);
    setInvoices([]);
    setOrders([]);
    setNotifications([]);
    setDashboardStats(null);
    setActiveTab('dashboard');
    setSelectedCafeId('all');
    setSelectedInvoiceForView(null);
    setSelectedInvoiceForEdit(null);
    setOrderProductId(null);
    setOrderConfirmation(null);
    setOrderReceipt(null); setActivity(null); seenNotifications.current.clear(); notificationsReady.current = false;
  };

  // The browser attaches the server session cookie to same-origin API requests.
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    if (!response.ok && response.status !== 401) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'La requête a échoué.');
    }
    return response;
  };

  // Load all core data from API backend Express service
  const loadAllData = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Validate session token credentials or log out
      const meRes = await authFetch("/api/auth/me");
      if (meRes.status === 401) {
        setToken(null);
        setCurrentUser(null);
        return;
      }
      const meData = await meRes.json();
      setCurrentUser(meData.user);

      // Force filter selectedCafeId dynamically for cafe role users
      const activeCafeScope = meData.user?.role === "cafe" ? meData.user.id : selectedCafeId;

      // 2. Fetch dataset in parallel (robust & non-blocking)
      const dashUrl = activeCafeScope === "all" ? "/api/dashboard" : `/api/dashboard?cafeId=${activeCafeScope}`;
      const [prodRes, invRes, dashRes, cafeRes, ordersRes, notifsRes] = await Promise.all([
        authFetch("/api/products"),
        authFetch("/api/invoices"),
        authFetch(dashUrl),
        authFetch("/api/cafes"),
        authFetch("/api/orders"),
        authFetch("/api/notifications")
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
      }
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData);
      }
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setDashboardStats(dashData);
      }
      if (cafeRes.ok) {
        const cafeData = await cafeRes.json();
        setCafes(cafeData);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      if (notifsRes.ok) {
        const notifsData = await notifsRes.json();
        setNotifications(notifsData);
        notifsData.forEach((notification: AppNotification) => seenNotifications.current.add(notification.id));
        notificationsReady.current = true;
      }
    } catch (err: any) {
      console.error("Error loading Arima application records:", err);
      setErrorMessage(err.message || "Échec du chargement des données. Veuillez vérifier la connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch immediately whenever token or selectedCafeId is configured
  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token, selectedCafeId]);

  // Vercel notifications use a lightweight visible-tab poll, without resetting
  // a café's basket or an administrator's open form.
  useEffect(() => {
    if (!token || !currentUser?.id) return;
    const controller = new AbortController(); let pending = false;
    const sync = async () => {
      if (document.hidden || pending || !notificationsReady.current) return;
      pending = true;
      try {
        const response = await fetch('/api/notifications', { credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) return;
        const incoming: AppNotification[] = await response.json();
        if (controller.signal.aborted) return;
        const fresh = incoming.filter(notification => !notification.read && !seenNotifications.current.has(notification.id));
        incoming.forEach(notification => seenNotifications.current.add(notification.id));
        setNotifications(incoming);
        if (fresh.length) {
          setActivity(fresh.find(notification => notification.title === 'Nouvelle facture reçue') || fresh.at(-1)!);
          const scope = currentUser.role === 'cafe' ? currentUser.id : selectedCafeId;
          const urls = ['/api/orders', '/api/invoices', scope === 'all' ? '/api/dashboard' : `/api/dashboard?cafeId=${scope}`];
          const responses = await Promise.all(urls.map(url => fetch(url, { credentials: 'same-origin', signal: controller.signal })));
          const values = await Promise.all(responses.map(response => response.ok ? response.json() : null));
          if (!controller.signal.aborted) { if (values[0]) setOrders(values[0]); if (values[1]) setInvoices(values[1]); if (values[2]) setDashboardStats(values[2]); }
        }
      } catch { /* The next visible poll retries; an open order must remain usable. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(sync, 10000);
    window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [token, currentUser?.id, selectedCafeId]);

  // --- Products CRUD handlers ---
  const handleAddProduct = async (prodData: Omit<Product, "id">) => {
    try {
      const res = await authFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(prodData)
      });
      if (!res.ok) throw new Error("Impossible d'ajouter le produit.");
      await loadAllData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleEditProduct = async (id: string, prodData: Omit<Product, "id">) => {
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(prodData)
      });
      if (!res.ok) throw new Error("Impossible de modifier la désignation.");
      await loadAllData();
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Impossible de supprimer le produit.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    }
  };

  // --- Invoices CRUD handlers ---
  const handleSaveInvoice = async (invoicePayload: any) => {
    try {
      const method = selectedInvoiceForEdit ? "PUT" : "POST";
      const url = selectedInvoiceForEdit
        ? `/api/invoices/${selectedInvoiceForEdit.id}`
        : "/api/invoices";

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(invoicePayload)
      });

      if (!res.ok) throw new Error("La sauvegarde de la facture a échoué.");
      
      const savedInvoice = await res.json();
      
      await loadAllData();
      
      // Directly redirect to view printed copy of the newly saved invoice
      setSelectedInvoiceForView(savedInvoice);
      setActiveTab("view-invoice");
      setSelectedInvoiceForEdit(null);
    } catch (err: any) {
      alert(err.message || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "paid" })
      });
      if (!res.ok) throw new Error("Échec du règlement financier de décompte.");
      
      const updatedInv = await res.json();
      setSelectedInvoiceForView(updatedInv);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur lors du marquage comme payé.");
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("La suppression de la facture a échoué.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur d'effacement de facture.");
    }
  };

  // --- Cafes CRUD handlers ---
  const handleAddCafe = async (name: string, username?: string, password?: string) => {
    try {
      const res = await authFetch("/api/cafes", {
        method: "POST",
        body: JSON.stringify({ name, prices: {}, username, password })
      });
      if (!res.ok) throw new Error("Impossible d'ajouter l'établissement.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur de création de l'établissement.");
      throw err;
    }
  };

  const handleUpdateCafe = async (id: string, name: string, prices: { [productId: string]: number }, username?: string, password?: string) => {
    try {
      const res = await authFetch(`/api/cafes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, prices, username, ...(password ? { password } : {}) })
      });
      if (!res.ok) throw new Error("Impossible de modifier l'établissement.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur de modification des prix.");
      throw err;
    }
  };

  const handleDeleteCafe = async (id: string) => {
    try {
      const res = await authFetch(`/api/cafes/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Impossible de supprimer l'établissement.");
      if (selectedCafeId === id) {
        setSelectedCafeId("all");
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur de suppression.");
    }
  };

  // --- Orders Management CRUD handlers ---
  const handleSubmitOrder = async (orderPayload: {
    cafeId: string;
    cafeName: string;
    submissionKey: string;
    items: { productId: string; quantity: number }[];
  }) => {
    try {
      const res = await authFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) throw new Error("L'enregistrement de la commande a échoué.");
      const savedOrder: OrderSubmissionResult = await res.json();
      const { invoice, ...order } = savedOrder;
      setOrders(previous => [...previous.filter(existing => existing.id !== order.id), order]);
      if (invoice) setInvoices(previous => [...previous.filter(existing => existing.id !== invoice.id), invoice]);
      await loadAllData();
      setOrderProductId(null);
      if (invoice) {
        setSelectedInvoiceForView(invoice); setActiveTab('view-invoice'); setOrderReceipt({ order, invoice }); setOrderConfirmation(null);
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        setOrderConfirmation(`Commande ${savedOrder.orderNumber} envoyée à Maison ARIMA.`); setActiveTab('orders');
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("La mise à jour du statut a échoué.");
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur de mise à jour du statut.");
      throw err;
    }
  };

  const handleConvertOrderToInvoice = async (orderId: string) => {
    try {
      const res = await authFetch(`/api/orders/${orderId}/convert`, {
        method: "POST",
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "La conversion en facture a échoué.");
      }
      const result = await res.json();
      await loadAllData();
      
      // Auto redirect to view the newly compiled PDF invoice print view
      setSelectedInvoiceForView(result.invoice);
      setActiveTab("view-invoice");
    } catch (err: any) {
      alert(err.message || "Erreur de conversion.");
      throw err;
    }
  };

  // --- Notifications management ---
  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      const res = await authFetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // --- Tab Routing Redirection helpers ---
  const handleViewInvoice = (inv: Invoice) => {
    setSelectedInvoiceForView(inv);
    setActiveTab("view-invoice");
  };

  const handleViewInvoiceById = async (invoiceId: string) => {
    try {
      const local = invoices.find(i => i.id === invoiceId);
      const invoice = local || await (await authFetch(`/api/invoices/${invoiceId}`)).json();
      if (!invoice?.id) throw new Error('La facture est introuvable.');
      setSelectedInvoiceForView(invoice); setActiveTab('view-invoice'); window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir la facture.'); }
  };
  const handleOpenNotification = async (notification: AppNotification) => {
    setActivity(null);
    void handleMarkNotificationAsRead(notification.id);
    if (notification.invoiceId) await handleViewInvoiceById(notification.invoiceId);
    else if (notification.orderId) { await loadAllData(); setActiveTab('orders'); window.scrollTo({ top: 0, behavior: 'instant' }); }
  };

  const handleEditInvoiceClick = (inv: Invoice) => {
    setSelectedInvoiceForEdit(inv);
    setActiveTab("create-invoice");
  };

  if (!token) return <AdminLoginView onLoginSuccess={setToken} />;
  if (!currentUser) return <div className="boot-screen"><BrandLogo /><span>{errorMessage || 'Votre espace se prépare…'}</span>{errorMessage && <button className="btn-primary" onClick={loadAllData}>Réessayer</button>}</div>;

  const isCafe = currentUser.role === 'cafe';
  const startOrder = (productId?: string) => { setOrderProductId(productId || null); setOrderConfirmation(null); setOrderReceipt(null); setActiveTab('create-order'); };
  const create = () => { setSelectedInvoiceForEdit(null); if (isCafe) startOrder(); else setActiveTab('create-invoice'); };
  return <AppShell activeView={activeTab} onNavigate={view => { if (isCafe && !['products', 'orders', 'catalogue', 'invoices', 'dashboard'].includes(view)) return; setActiveTab(view as Tab); setSelectedInvoiceForEdit(null); }} user={currentUser} notifications={notifications} onReadNotification={handleMarkNotificationAsRead} onOpenNotification={handleOpenNotification} onLogout={handleLogout} onCreate={create} onRefresh={loadAllData} loading={loading}>
    {orderReceipt && <OrderReceiptCelebration order={orderReceipt.order} invoice={orderReceipt.invoice} onClose={() => setOrderReceipt(null)} />}
    {activity && createPortal(<div className="new-activity-toast no-print" role="status"><BellRing size={23} /><div><strong>{activity.title}</strong><p>{activity.message}</p>{(activity.invoiceId || activity.orderId) && <button type="button" onClick={() => void handleOpenNotification(activity)}>{activity.invoiceId ? 'Voir la facture' : 'Voir la commande'} ↗</button>}</div><button type="button" aria-label="Fermer la notification" onClick={() => setActivity(null)}><X size={17} /></button></div>, document.body)}
    {errorMessage && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{errorMessage}</span><button onClick={loadAllData}>Réessayer</button></div>}
    {loading && !dashboardStats ? <div className="dashboard-skeleton" aria-label="Chargement des données"><div /><div /><div /><section /><section /></div> : <div className="view-content" aria-busy={loading}>
      {orderConfirmation && activeTab === 'orders' && <div className="success-banner" role="status"><Check size={18} /><span>{orderConfirmation}</span><button aria-label="Fermer la confirmation" onClick={() => setOrderConfirmation(null)}><X size={16} /></button></div>}
      {activeTab === 'dashboard' && isCafe && <CafeDashboardView user={currentUser} invoices={invoices} orders={orders} onViewInvoice={handleViewInvoice} onInvoices={() => setActiveTab('invoices')} onOrders={() => setActiveTab('orders')} onProducts={() => setActiveTab('products')} />}
      {activeTab === 'dashboard' && !isCafe && dashboardStats && <DashboardView stats={dashboardStats} cafes={cafes} selectedCafeId={selectedCafeId} onSelectedCafeChange={setSelectedCafeId} onViewInvoice={handleViewInvoice} onNavigateToInvoices={() => setActiveTab('invoices')} onNavigateToProducts={() => setActiveTab('products')} />}
      {activeTab === 'videos' && !isCafe && <div className="admin-videos-page"><h1 className="sr-only">Vidéos ARIMA</h1><CafeCinema onExplore={() => setActiveTab('products')} /></div>}
      {activeTab === 'products' && !isCafe && <ProductCatalogView products={products} cafes={cafes} onAddProduct={handleAddProduct} onEditProduct={handleEditProduct} onDeleteProduct={handleDeleteProduct} />}
      {activeTab === 'products' && isCafe && <CafeProductsView products={products} cafeName={currentUser.name} onStartOrder={() => startOrder()} onOrderProduct={startOrder} onViewCatalogues={() => setActiveTab('catalogue')} />}
      {activeTab === 'catalogue' && <CatalogueBookView />}
      {activeTab === 'tickets' && !isCafe && <TicketsView />}
      {activeTab === 'cafes' && !isCafe && <CafeManagementView cafes={cafes} products={products} onAddCafe={handleAddCafe} onUpdateCafe={handleUpdateCafe} onDeleteCafe={handleDeleteCafe} />}
      {activeTab === 'invoices' && <InvoiceListView invoices={invoices} onAddInvoiceClick={create} onEditInvoiceClick={handleEditInvoiceClick} onViewInvoiceClick={handleViewInvoice} onDeleteInvoice={handleDeleteInvoice} readOnly={isCafe} />}
      {activeTab === 'create-invoice' && !isCafe && <InvoiceCreateEditView products={products} cafes={cafes} invoiceToEdit={selectedInvoiceForEdit} onCancel={() => { setSelectedInvoiceForEdit(null); setActiveTab('invoices'); }} onSaveInvoice={handleSaveInvoice} />}
      {activeTab === 'view-invoice' && selectedInvoiceForView && <InvoiceDetailPrintView invoice={selectedInvoiceForView} onBack={() => { setSelectedInvoiceForView(null); setActiveTab('invoices'); }} onMarkAsPaid={isCafe ? undefined : handleMarkAsPaid} />}
      {activeTab === 'orders' && <OrdersListView orders={orders} cafes={cafes} currentUser={currentUser} onUpdateOrderStatus={handleUpdateOrderStatus} onConvertOrderToInvoice={handleConvertOrderToInvoice} onStartNewOrder={() => startOrder()} onViewInvoiceById={handleViewInvoiceById} />}
      {activeTab === 'create-order' && <OrderCreateView products={products} cafes={cafes} currentUser={currentUser} initialProductId={orderProductId} onBack={() => { setOrderProductId(null); setActiveTab('orders'); }} onSubmitOrder={handleSubmitOrder} />}
    </div>}
  </AppShell>;
}
