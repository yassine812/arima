import React, { useState, useMemo } from "react";
import { Search, Calendar, Filter, ShoppingBag, Plus, RefreshCw, CheckCircle, Clock, Sparkles } from "lucide-react";
import { Order, OrderStatus, Cafe } from "../types";
import { motion } from "motion/react";
import AtelierHero from './AtelierHero';

interface OrdersListViewProps {
  orders: Order[];
  cafes: Cafe[];
  currentUser: { id: string; name: string; role: string } | null;
  onUpdateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  onConvertOrderToInvoice: (id: string) => Promise<void>;
  onStartNewOrder: () => void;
  onViewInvoiceById?: (id: string) => void;
}

export default function OrdersListView({
  orders,
  cafes,
  currentUser,
  onUpdateOrderStatus,
  onConvertOrderToInvoice,
  onStartNewOrder,
  onViewInvoiceById,
}: OrdersListViewProps) {
  const isCafe = currentUser?.role === "cafe";

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");

  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [confirmConvertId, setConfirmConvertId] = useState<string | null>(null);

  // Status mapping to elegant badges
  const getStatusBadgeAndStyles = (status: OrderStatus) => {
    switch (status) {
      case "En attente":
        return {
          label: "En attente",
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "En préparation":
        return {
          label: "En préparation",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "Prête":
        return {
          label: "Prête",
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
        };
      case "Livrée":
        return {
          label: "Livrée",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "Annulée":
        return {
          label: "Annulée",
          bg: "bg-stone-50 text-stone-500 border-stone-200",
        };
      default:
        return {
          label: status,
          bg: "bg-stone-50 text-stone-700 border-stone-200",
        };
    }
  };

  // Perform filtering
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Search text queries
        const matchesQuery =
          o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.cafeName.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Status filter
        const matchesStatus = statusFilter === "all" || o.status === statusFilter;

        // Date filter
        const matchesDate = !dateFilter || o.date === dateFilter;

        return matchesQuery && matchesStatus && matchesDate;
      })
      .sort((a, b) => b.orderNumber.localeCompare(a.orderNumber)); // sorted reverse-chronologically
  }, [orders, searchQuery, statusFilter, dateFilter]);

  // Aggregate stats of filtered orders
  const stats = useMemo(() => {
    const totalCount = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, o) => sum + o.totalQuantity, 0);
    const totalEstimatedValue = filteredOrders.reduce((sum, o) => sum + o.estimatedValue, 0);

    return {
      totalCount,
      totalQuantity,
      totalEstimatedValue,
    };
  }, [filteredOrders]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setLoadingOrderId(orderId);
      await onUpdateOrderStatus(orderId, newStatus);
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut.");
    } finally {
      setLoadingOrderId(null);
    }
  };

  const confirmAndConvert = async (orderId: string) => {
    try {
      setLoadingOrderId(orderId);
      await onConvertOrderToInvoice(orderId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrderId(null);
      setConfirmConvertId(null);
    }
  };

  return (
    <div className="orders-page space-y-6">
      {/* Header section */}
      <AtelierHero kind="pistache" eyebrow="DU BONHEUR EN PRÉPARATION" title={<>Les prochaines <em>douceurs.</em></>} description={isCafe ? 'Vos gourmandises préférées, de notre atelier à votre café.' : 'Un peu de soin à chaque étape. Suivez les commandes, de l’atelier à la livraison.'}>
        <button
          onClick={onStartNewOrder}
          className="btn-primary flex items-center gap-2 bg-amber-800 hover:bg-amber-900 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Passer une commande</span>
        </button>
      </AtelierHero>

      {/* Aggregate stats indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-4.5 shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Volume de commandes</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="font-serif text-2xl font-bold text-stone-900">{stats.totalCount}</span>
            <span className="text-[11px] text-stone-500">soumises</span>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-4.5 shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Quantité totale commandée</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="font-serif text-2xl font-bold text-stone-900">{stats.totalQuantity}</span>
            <span className="text-[11px] text-stone-500">produits</span>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-4.5 shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Valeur estimée cumulée</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="font-serif text-2xl font-bold text-amber-800">{stats.totalEstimatedValue.toFixed(3).replace('.', ',')}</span>
            <span className="text-[11px] text-stone-500 font-bold">DT</span>
          </div>
        </div>
      </div>

      {/* Filters Form Panel */}
      <div className="bg-white/40 border border-white/30 rounded-2xl p-4.5 flex flex-col md:flex-row items-center gap-4">
        {/* Search Input bar */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par numéro ou café..."
            className="w-full bg-stone-102 border border-stone-200/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 outline-none focus:border-amber-700 transition-colors"
          />
        </div>

        {/* Date Filter input */}
        <div className="relative w-full md:w-44">
          <Calendar className="absolute left-3 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-stone-102 border border-stone-200/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors"
          />
        </div>

        {/* Status selection slider */}
        <div className="relative w-full md:w-44">
          <Filter className="absolute left-3 top-3 w-4 h-4 text-stone-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-stone-102 border border-stone-200/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors"
          >
            <option value="all">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="En préparation">En préparation</option>
            <option value="Prête">Prête</option>
            <option value="Livrée">Livrée</option>
            <option value="Annulée">Annulée</option>
          </select>
        </div>
      </div>

      {/* Orders grid cards checklist */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white/40 rounded-2xl border border-stone-200/40 text-stone-400 space-y-2">
          <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
          <p className="font-serif text-sm font-semibold">Aucune commande ne correspond</p>
          <p className="text-[11px]">Modifiez vos critères de filtrage ou créez une nouvelle commande.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((o) => {
            const badg = getStatusBadgeAndStyles(o.status);
            const isConverting = loadingOrderId === o.id;

            return (
              <div
                key={o.id}
                className="order-card bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 p-5 shadow-sm hover:bg-white/80 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                {/* Details left side */}
                <div className="order-card-details space-y-2.5 flex-1 min-w-0 pr-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-stone-900">{o.orderNumber}</span>
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded border ${badg.bg}`}>
                      {badg.label}
                    </span>
                    <span className="text-[10px] text-stone-450 font-mono flex items-center gap-1.5 pl-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {o.date}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-stone-900 text-sm">{o.cafeName}</h3>
                    
                    {/* Items preview snippet */}
                    <p className="text-stone-500 text-[11px] mt-1 line-clamp-1">
                      {o.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-stone-400 font-mono">
                    <span>Quantité: <span className="font-bold text-stone-800">{o.totalQuantity} pces</span></span>
                    <span>Valeur: <span className="font-bold text-amber-800">{o.estimatedValue.toFixed(3).replace('.', ',')} DT</span></span>
                  </div>
                </div>

                {/* Actions right side controls */}
                <div className="order-card-actions flex flex-wrap items-center gap-3 shrink-0 self-end md:self-center">
                  
                  {/* Café user cancellation action (only if En attente) */}
                  {isCafe && o.status === "En attente" && (
                    <button
                      onClick={() => handleStatusChange(o.id, "Annulée")}
                      disabled={isConverting}
                      className="bg-red-50 hover:bg-red-100/85 text-red-700 py-1.5 px-3 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Annuler la commande
                    </button>
                  )}

                  {/* Admin actions (Status modifier dropdown and Invoice generator) */}
                  {!isCafe && (
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* Statut selector */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-[9px] font-extrabold uppercase text-stone-400 font-sans tracking-wide">État :</label>
                        <select
                          value={o.status}
                          disabled={o.status === "Livrée" || o.status === "Annulée"}
                          onChange={(e) => handleStatusChange(o.id, e.target.value as OrderStatus)}
                          className="bg-stone-50 border border-stone-200/80 rounded-lg text-[11px] py-1 px-2.5 font-semibold text-stone-800 outline-none focus:border-amber-700 disabled:opacity-60"
                        >
                          <option value="En attente">En attente</option>
                          <option value="En préparation">En préparation</option>
                          <option value="Prête">Prête</option>
                          <option value="Livrée">Livrée</option>
                          <option value="Annulée">Annulée</option>
                        </select>
                      </div>

                      {/* Convert button */}
                      {o.convertedToInvoiceId ? (
                        <button
                          onClick={() => onViewInvoiceById?.(o.convertedToInvoiceId!)}
                          className="text-[10px] text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg font-mono flex items-center gap-1 transition-all cursor-pointer font-bold"
                          title="Cliquer pour afficher la facture imprimable et exporter en PDF"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Facture: {o.convertedToInvoiceNumber} (Voir/PDF)</span>
                        </button>
                      ) : confirmConvertId === o.id ? (
                        <div className="flex items-center gap-1.5 bg-stone-50 border border-amber-200/50 p-1 rounded-xl">
                          <span className="text-[9px] font-extrabold uppercase text-amber-900 px-1 font-sans">Générer ?</span>
                          <button
                            type="button"
                            onClick={() => confirmAndConvert(o.id)}
                            disabled={isConverting}
                            className="bg-emerald-700 hover:bg-emerald-805 text-white text-[9px] font-bold py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmConvertId(null)}
                            disabled={isConverting}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-[9px] font-bold py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmConvertId(o.id)}
                          disabled={o.status === "Annulée" || isConverting}
                          className={`flex items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all shadow-sm ${
                            o.status === "Annulée"
                              ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                              : "bg-amber-800 hover:bg-amber-900 text-white cursor-pointer"
                          }`}
                        >
                          {isConverting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShoppingBag className="w-3.5 h-3.5" />
                          )}
                          <span>Générer Facture</span>
                        </button>
                      )}

                    </div>
                  )}

                  {!isCafe && o.status === "Livrée" && o.convertedToInvoiceId && (
                    <div className="hidden lg:block h-6 w-[1px] bg-stone-200"></div>
                  )}

                  {/* Just showing Converted tag on Café portal */}
                  {isCafe && o.convertedToInvoiceId && (
                    <button
                      onClick={() => onViewInvoiceById?.(o.convertedToInvoiceId!)}
                      className="text-[10px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 py-1.5 px-3 rounded-lg font-mono font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
                      title="Cliquer pour afficher la facture et l'exporter en PDF"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{o.convertedToInvoiceNumber} (Exporter PDF)</span>
                    </button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
