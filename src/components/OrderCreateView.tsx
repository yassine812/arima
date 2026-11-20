import React, { useState, useMemo } from "react";
import { ArrowLeft, Coffee, Plus, Minus, ShoppingBag, RefreshCw, AlertCircle } from "lucide-react";
import { Product, Cafe } from "../types";
import { productPhoto } from '../productPhotos';

interface OrderCreateViewProps {
  products: Product[];
  cafes: Cafe[];
  currentUser: { id: string; name: string; role: string } | null;
  initialProductId?: string | null;
  onBack: () => void;
  onSubmitOrder: (orderData: { cafeId: string; cafeName: string; items: { productId: string; quantity: number }[] }) => Promise<void>;
}

export default function OrderCreateView({
  products,
  cafes,
  currentUser,
  onBack,
  initialProductId,
  onSubmitOrder,
}: OrderCreateViewProps) {
  const isCafe = currentUser?.role === "cafe";
  
  // Resolve preselected cafe for cafe portal or let admin select
  const [selectedCafeId, setSelectedCafeId] = useState<string>(
    isCafe ? currentUser?.id || "" : cafes[0]?.id || ""
  );

  const matchedCafe = useMemo(() => {
    return cafes.find((c) => c.id === selectedCafeId);
  }, [cafes, selectedCafeId]);

  // Quantities map: productId -> quantity
  const [quantities, setQuantities] = useState<{ [productId: string]: number }>(() => initialProductId && products.some(p => p.id === initialProductId) ? { [initialProductId]: 1 } : {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Helper to resolve unit price for product under selected cafe context
  const getProductPrice = (productId: string, basePrice: number): number => {
    if (matchedCafe && matchedCafe.prices && matchedCafe.prices[productId] !== undefined) {
      return Number(matchedCafe.prices[productId]);
    }
    return Number(basePrice);
  };

  const handleIncrement = (productId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const handleDecrement = (productId: string) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: current - 1,
      };
    });
  };

  const handleQuantityTextChange = (productId: string, valueStr: string) => {
    const val = parseInt(valueStr, 10);
    if (isNaN(val) || val <= 0) {
      setQuantities((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } else {
      setQuantities((prev) => ({
        ...prev,
        [productId]: val,
      }));
    }
  };

  // Compute checkout summary
  const orderItemsData = useMemo(() => {
    return Object.entries(quantities)
      .map(([pId, qty]) => {
        const prod = products.find((p) => p.id === pId);
        if (!prod) return null;
        const price = Number(getProductPrice(pId, prod.price));
        return {
          productId: pId,
          name: prod.name,
          price,
          quantity: Number(qty),
          total: Number(price) * Number(qty),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [quantities, products, selectedCafeId, matchedCafe, getProductPrice]);

  const totalQuantity = useMemo(() => {
    return orderItemsData.reduce((sum, item) => sum + item.quantity, 0);
  }, [orderItemsData]);

  const estimatedValue = useMemo(() => {
    return orderItemsData.reduce((sum, item) => sum + item.total, 0);
  }, [orderItemsData]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const map: { [category: string]: Product[] } = {};
    products.forEach((p) => {
      if (!map[p.category]) {
        map[p.category] = [];
      }
      map[p.category].push(p);
    });
    return map;
  }, [products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);
    if (orderItemsData.length === 0) {
      setSubmitError("Veuillez ajouter au moins un produit à votre commande.");
      return;
    }
    if (!selectedCafeId) {
      setSubmitError("Veuillez sélectionner un établissement.");
      return;
    }

    try {
      setIsSubmitting(true);
      const itemsPayload = orderItemsData.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }));
      
      const cafeName = matchedCafe ? matchedCafe.name : "Café";
      await onSubmitOrder({
        cafeId: selectedCafeId,
        cafeName,
        items: itemsPayload,
      });

    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Impossible d’envoyer la commande. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with back link */}
      <div className="atelier-page-heading flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2.5 bg-stone-105 hover:bg-stone-200 text-stone-600 rounded-xl transition-all cursor-pointer"
          title="Retour aux commandes"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900">Un panier de douceurs.</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Sélectionnez vos gourmandises et ajustez les quantités. Les prix s'ajustent automatiquement.
          </p>
        </div>
      </div>

      {submitError && <div className="form-error" role="alert"><AlertCircle size={17} />{submitError}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Select Product & Cards Catalog */}
          <div className="lg:col-span-2 space-y-8 order-2 lg:order-1">
            
            {/* Café selector (if Admin) */}
            {!isCafe && (
              <div className="bg-white/60 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-stone-700">
                  <Coffee className="w-4 h-4 text-amber-800" />
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-550">Établissement Client</span>
                </div>
                <select
                  value={selectedCafeId}
                  onChange={(e) => {
                    setSelectedCafeId(e.target.value);
                    setQuantities({}); // Reset cart on change to refresh correct pricing rules!
                  }}
                  className="w-full bg-stone-150 border border-stone-250 py-3 px-4 rounded-xl text-stone-900 text-sm outline-none focus:border-amber-700 transition-colors"
                >
                  {cafes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-400 italic">
                  Note : le changement d'établissement réinitialise le panier afin de charger la liste tarifaire correspondante.
                </p>
              </div>
            )}

            {isCafe && (
              <div className="bg-amber-50/25 border border-amber-200/30 p-4 rounded-2xl text-xs text-stone-600">
                Commande passée en tant que : <span className="font-bold text-amber-950 font-serif text-sm">{matchedCafe?.name}</span>
              </div>
            )}

            {/* Catalog list grouped by category */}
            {(Object.entries(groupedProducts) as [string, Product[]][]).map(([category, catProducts]) => (
              <div key={category} className="space-y-4">
                <h3 className="font-serif text-xl font-bold text-stone-800 border-b border-stone-100 pb-2">
                  {category}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {catProducts.map((p) => {
                    const price = getProductPrice(p.id, p.price);
                    const qty = quantities[p.id] || 0;

                    return (
                      <div
                        key={p.id}
                        className={`bg-white/60 backdrop-blur-md border rounded-2xl p-4 transition-all flex items-center justify-between ${
                          qty > 0 ? "border-amber-400 bg-amber-50/10 shadow-sm" : "border-white/40 hover:bg-white/80"
                        }`}
                      >
                        {productPhoto(p) && <img className="order-product-thumb" src={productPhoto(p)} alt="" loading="lazy" />}
                        <div className="truncate flex-1 pr-3">
                          <h4 className="font-serif font-bold text-stone-900 text-sm truncate" title={p.name}>
                            {p.name}
                          </h4>
                          <p className="font-mono text-xs font-bold text-amber-800 mt-1">
                            {price.toFixed(3).replace('.', ',')} DT <span className="text-[10px] text-stone-400 font-sans font-normal">/ pce</span>
                          </p>
                        </div>

                        {/* Plus/Minus controller */}
                        <div className="flex items-center gap-2 shrink-0">
                          {qty > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDecrement(p.id)}
                                aria-label={`Diminuer la quantité de ${p.name}`}
                                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              
                              <input
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                                value={qty}
                                aria-label={`Quantité de ${p.name}`}
                                onChange={(e) => handleQuantityTextChange(p.id, e.target.value)}
                                className="w-10 text-center font-mono font-bold text-xs bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              <button
                                type="button"
                                onClick={() => handleIncrement(p.id)}
                                aria-label={`Augmenter la quantité de ${p.name}`}
                                className="w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleIncrement(p.id)}
                              className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs py-1.5 px-3 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Ajouter</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Persistent Order Summary Checkout panel */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-white/50 p-6 shadow-xl shadow-amber-950/2 space-y-6 sticky top-6">
              
              <div className="flex items-center gap-2 pb-4 border-b border-stone-100/80">
                <ShoppingBag className="w-5 h-5 text-amber-800" />
                <h3 className="font-serif text-lg font-bold text-stone-900">Récapitulatif</h3>
              </div>

              {orderItemsData.length === 0 ? (
                <div className="text-center py-8 text-stone-400 space-y-2">
                  <p className="text-xs font-semibold">Le panier est encore vide</p>
                  <p className="text-[10px] leading-relaxed">
                    Cliquez sur les produits de la liste de gauche pour composer votre commande.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Items list with totals */}
                  <div className="max-h-60 overflow-y-auto pr-1 space-y-2.5 divide-y divide-stone-105">
                    {orderItemsData.map((it) => (
                      <div key={it.productId} className="flex justify-between items-start pt-2.5 text-xs">
                        <div className="truncate max-w-[150px]">
                          <span className="font-bold text-stone-800 font-serif block truncate">{it.name}</span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {it.quantity} × {it.price.toFixed(3).replace('.', ',')} DT
                          </span>
                        </div>
                        <span className="font-mono font-bold text-stone-800 pl-2 shrink-0">
                          {it.total.toFixed(3).replace('.', ',')} DT
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Summary Totals */}
                  <div className="bg-stone-50 rounded-2xl p-4 space-y-2.5 border border-stone-100 font-sans">
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Quantité Totale</span>
                      <span className="font-mono font-bold text-stone-800">{totalQuantity} pces</span>
                    </div>
                    <div className="flex justify-between text-base font-serif font-bold text-stone-900 border-t border-stone-200/50 pt-2.5">
                      <span>Valeur Estimée</span>
                      <span className="font-mono text-amber-800">{estimatedValue.toFixed(3).replace('.', ',')} DT</span>
                    </div>
                  </div>

                  {/* Checkout buttons */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full bg-amber-800 hover:bg-amber-900 disabled:bg-stone-300 text-white rounded-xl py-3.5 text-xs font-bold shadow-lg shadow-amber-950/10 cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Confirmer & Passer Commande</span>
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-center text-stone-400">
                    Votre commande sera transmise à Maison ARIMA. Retrouvez son avancement dans Mes commandes.
                  </p>
                </div>
              )}
            </div>
          </div>

        </form>
    </div>
  );
}
