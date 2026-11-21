import React, { useState, useEffect } from "react";
import { Plus, Trash2, Search, Calendar, User, Phone, MapPin, Percent, DollarSign, Calculator, Check, ArrowLeft, Receipt, Coffee } from "lucide-react";
import { Product, Invoice, InvoiceItem, Cafe } from "../types";
import { motion } from "motion/react";
import { productPhoto } from '../productPhotos';

interface InvoiceCreateEditViewProps {
  products: Product[];
  cafes: Cafe[];
  invoiceToEdit?: Invoice | null;
  onSaveInvoice: (invoiceData: any) => Promise<void>;
  onCancel: () => void;
}

export default function InvoiceCreateEditView({
  products,
  cafes,
  invoiceToEdit,
  onSaveInvoice,
  onCancel,
}: InvoiceCreateEditViewProps) {
  // Client Info States
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(19); // 19% standard Tunisia VAT
  const [status, setStatus] = useState<"paid" | "unpaid">("unpaid");
  
  // Café State Selection
  const [selectedCafeId, setSelectedCafeId] = useState("");
  const [selectedCafeName, setSelectedCafeName] = useState("");

  // Selected Invoice Items
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number }[]>([]);
  
  // Searching helper
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Load existing data if editing
  useEffect(() => {
    if (invoiceToEdit) {
      setCustomerName(invoiceToEdit.customerName);
      setCustomerPhone(invoiceToEdit.customerPhone || "");
      setCustomerAddress(invoiceToEdit.customerAddress || "");
      setDate(invoiceToEdit.date);
      setTaxEnabled(invoiceToEdit.taxEnabled);
      setTaxRate(invoiceToEdit.taxRate || 19);
      setStatus(invoiceToEdit.status as "paid" | "unpaid");
      setSelectedCafeId(invoiceToEdit.cafeId || "");
      setSelectedCafeName(invoiceToEdit.cafeName || "");
      
      const mapped = invoiceToEdit.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity
      }));
      setSelectedItems(mapped);
    } else {
      // Set defaults for simple creation
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDate(new Date().toISOString().split("T")[0]);
      setTaxEnabled(true);
      setTaxRate(19);
      setStatus("unpaid");
      setSelectedCafeId("");
      setSelectedCafeName("");
      setSelectedItems([]);
    }
  }, [invoiceToEdit]);

  // Handle live search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
      setSearchResults(filtered);
    }
  }, [searchQuery, products]);

  // Helper to dynamically lookup active product price depending on chosen café
  const getProductPrice = (p: Product) => {
    if (selectedCafeId) {
      const activeCafe = cafes.find((c) => c.id === selectedCafeId);
      if (activeCafe && activeCafe.prices && activeCafe.prices[p.id] !== undefined) {
        return activeCafe.prices[p.id];
      }
    }
    return p.price;
  };

  // Calculations
  const calculateSubtotal = () => {
    return selectedItems.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return sum;
      const price = getProductPrice(prod);
      return sum + price * item.quantity;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const taxAmount = taxEnabled ? (subtotal * taxRate) / 100 : 0;
  const total = subtotal + taxAmount;

  const handleAddItem = (productId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.find((it) => it.productId === productId);
      if (exists) {
        return prev.map((it) =>
          it.productId === productId ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
    setSearchQuery("");
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleQuantityChange = (productId: string, val: string) => {
    const q = parseFloat(val);
    if (isNaN(q) || q < 0) return;
    setSelectedItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, quantity: q } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) {
      alert("Veuillez saisir le nom du client.");
      return;
    }
    if (selectedItems.length === 0) {
      alert("Veuillez sélectionner au moins une pâtisserie dans la facture.");
      return;
    }

    const payload = {
      customerName,
      customerPhone,
      customerAddress,
      date,
      items: selectedItems.map(it => {
        const prod = products.find(p => p.id === it.productId);
        const priceToUse = prod ? getProductPrice(prod) : 0;
        return {
          productId: it.productId,
          name: prod ? prod.name : "Inconnu",
          price: priceToUse,
          quantity: it.quantity
        };
      }),
      taxEnabled,
      taxRate,
      status,
      cafeId: selectedCafeId || undefined,
      cafeName: selectedCafeName || undefined
    };

    await onSaveInvoice(payload);
  };

  const formatDT = (val: number) => {
    return val.toLocaleString("fr-TN", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + " DT";
  };

  return (
    <div className="invoice-editor-page space-y-6 font-sans">
      <div className="atelier-page-heading is-rose flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            aria-label="Retour aux factures"
            className="p-2 hover:bg-stone-100 rounded-xl border border-stone-200 text-stone-600 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-900">
              {invoiceToEdit ? `Modifier la facture ${invoiceToEdit.invoiceNumber}` : "Une nouvelle facture."}
            </h1>
            <p className="text-stone-500 text-xs mt-0.5">Saisissez les douceurs commandées et les informations de livraison.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
        >
          Annuler l'édition
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Invoice configuration and client information (col span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Café Selection Card */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 space-y-4">
            <h2 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-3 uppercase tracking-wider flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-700" />
              <span>Choix de l'Établissement (Café)</span>
            </h2>
            <div>
              <p className="text-[11px] text-stone-500 mb-2">
                Sélectionnez le café pour appliquer automatiquement ses tarifs spécifiques prédéfinis.
              </p>
              <select
                value={selectedCafeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCafeId(val);
                  const matched = cafes.find((c) => c.id === val);
                  setSelectedCafeName(matched ? matched.name : "");
                }}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-700 outline-none focus:ring-1 focus:ring-amber-500/15 focus:border-amber-700 transition-colors cursor-pointer animate-none"
              >
                <option value="">🌐 Tarifs de Base Arima (Standard)</option>
                {cafes.map((c) => (
                  <option key={c.id} value={c.id}>
                    ☕ {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 space-y-4">
            <h2 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-3 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" />
              <span>Coordonnées du Client</span>
            </h2>

            <div>
              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                Nom du Client *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="ex. Fatma Ben Mansour"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50/50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 text-stone-850 text-xs transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                  Téléphone
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    placeholder="ex. +216 98 123 456"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50/50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 text-stone-850 text-xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                  Date d'Émission (Auto-générée)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    required
                    readOnly
                    value={date}
                    className="w-full pl-9 pr-4 py-2 bg-stone-100 border border-stone-200 text-stone-500 rounded-xl focus:outline-none text-xs transition-all cursor-not-allowed"
                    title="La date est générée automatiquement à la création."
                  />
                </div>
                <span className="text-[9px] text-stone-400 mt-1 block">Défini automatiquement au jour de création.</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                Adresse Postale / Livraison
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="ex. Rue des Jasmins, Riadh El Andalous"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50/50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 text-stone-850 text-xs transition-all"
                />
              </div>
            </div>
          </div>

          {/* Tax, Status Configuration */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 space-y-4">
            <h2 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-3 uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-4 h-4 text-amber-700" />
              <span>Paramètres de Facturation</span>
            </h2>

            <div className="flex items-center justify-between py-2 rounded-lg bg-stone-50 px-3.5 border border-stone-100">
              <div className="text-xs">
                <span className="font-semibold text-stone-800 block">Appliquer la TVA</span>
                <span className="text-[10px] text-stone-400">Facturer la TVA de l'État</span>
              </div>
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="w-4.5 h-4.5 accent-amber-800 cursor-pointer"
              />
            </div>

            {taxEnabled && (
              <div>
                <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 text-stone-850 text-xs transition-all font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                Statut du Paiement
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("unpaid")}
                  className={`py-2.5 px-3 rounded-xl border text-center text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                    status === "unpaid"
                      ? "border-amber-800 bg-amber-50 text-amber-900 font-bold"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-stone-500"
                  }`}
                >
                  Non Payée
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("paid")}
                  className={`py-2.5 px-3 rounded-xl border text-center text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                    status === "paid"
                      ? "border-emerald-700 bg-emerald-50 text-emerald-800 font-bold"
                      : "border-stone-200 bg-white hover:bg-stone-50 text-stone-500"
                  }`}
                >
                  Payée
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice items, product selection (col span 3) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Product Search engine bar */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 space-y-4">
            <h2 className="font-serif text-sm font-bold text-stone-900 uppercase tracking-wider pb-1 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-700" />
              <span>Sélectionner des douceurs</span>
            </h2>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Tapez le nom d'un dessert... (ex: Baklawa, Kaak, Tarte)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-600 text-stone-850 text-xs transition-all"
              />
            </div>

            {/* Quick product results dropdown */}
            {searchResults.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100 bg-white shadow-lg relative z-20">
                {searchResults.map((p) => {
                  const resolvedPrice = getProductPrice(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddItem(p.id)}
                      className="w-full text-left py-2.5 px-4 hover:bg-amber-50/50 flex justify-between items-center text-xs transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-stone-800 block">{p.name}</span>
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider">{p.category}</span>
                      </div>
                      <span className="font-mono font-extrabold text-amber-900 bg-amber-50 px-2 py-1 rounded-md">
                        {formatDT(resolvedPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick-add popular grid if search is clean */}
            {searchQuery === "" && (
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">Accès rapide (Sélectionnez pour ajouter)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {products.slice(0, 6).map((p) => {
                    const resolvedPrice = getProductPrice(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddItem(p.id)}
                        className="invoice-product-pick"
                      >
                        {productPhoto(p) && <img src={productPhoto(p)} alt="" loading="lazy" />}
                        <span><strong>{p.name}</strong><small>{resolvedPrice.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT</small></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected Invoice Items Table */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 space-y-4">
            <h2 className="font-serif text-sm font-bold text-stone-900 border-b border-stone-100 pb-3 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-700" />
              <span>Détails de la Facture</span>
            </h2>

            {selectedItems.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs font-semibold">
                Aucune pâtisserie sélectionnée pour le moment.<br />
                <span className="text-[10px] font-medium text-amber-850/50 mt-1.5 block">Veuillez en choisir un élément ci-dessus.</span>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
                {selectedItems.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  if (!prod) return null;
                  const activePrice = getProductPrice(prod);
                  const itemTotal = activePrice * item.quantity;
                  
                  // Helper to detect if this product is priced per kg or per piece
                  const isKg = prod.name.toLowerCase().includes("kg") || prod.name.toLowerCase().includes("baklawa") || prod.name.toLowerCase().includes("kaak") || prod.name.toLowerCase().includes("samsa");

                  return (
                    <div key={item.productId} className="invoice-item-row py-3.5 flex justify-between items-center gap-4">
                      {/* Product identity */}
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-stone-800 text-xs line-clamp-2 leading-tight">
                          {prod.name}
                        </span>
                        <span className="text-[10px] text-stone-400 block font-mono">
                          {formatDT(activePrice)} / {isKg ? "kg" : "pièce"}
                        </span>
                      </div>

                      {/* Quantity input with unit */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={isKg ? "0.1" : "1"}
                          min="0.1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                          className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-center text-xs font-semibold font-mono"
                        />
                        <span className="text-[10px] font-semibold text-stone-400">
                          {isKg ? "kg" : "pc(s)"}
                        </span>
                      </div>

                      {/* Total and delete */}
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs font-bold text-stone-900">
                          {formatDT(itemTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="border-t border-stone-200/75 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-stone-500 font-semibold">
                <span>Sous-total</span>
                <span className="font-mono">{formatDT(subtotal)}</span>
              </div>
              {taxEnabled && (
                <div className="flex justify-between text-xs text-stone-400 font-semibold">
                  <span>TVA ({taxRate}%)</span>
                  <span className="font-mono">{formatDT(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-2 border-t border-dashed border-stone-200">
                <span>Net à payer (Tunisian Dinars)</span>
                <span className="font-serif text-base font-extrabold text-amber-900 font-mono">
                  {formatDT(total)}
                </span>
              </div>
            </div>

            {/* Form actions submission */}
            <div className="invoice-editor-actions pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
              <button
                type="button"
                onClick={onCancel}
                className="py-2.5 px-4 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs rounded-xl font-semibold transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2 py-2.5 px-5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white text-xs rounded-xl font-bold transition-all shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmer et Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
