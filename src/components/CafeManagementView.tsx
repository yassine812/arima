import React, { useState } from "react";
import { Coffee, Plus, Trash2, Edit3, Save, ArrowLeft, DollarSign, Check, Info, Heart } from "lucide-react";
import { Product, Cafe } from "../types";
import { motion, AnimatePresence } from "motion/react";
import AtelierHero from './AtelierHero';

interface CafeManagementViewProps {
  cafes: Cafe[];
  products: Product[];
  onAddCafe: (name: string, username?: string, password?: string) => Promise<void>;
  onUpdateCafe: (id: string, name: string, prices: { [productId: string]: number }, username?: string, password?: string) => Promise<void>;
  onDeleteCafe: (id: string) => Promise<void>;
}

export default function CafeManagementView({
  cafes,
  products,
  onAddCafe,
  onUpdateCafe,
  onDeleteCafe,
}: CafeManagementViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCafeName, setNewCafeName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editingCafe, setEditingCafe] = useState<Cafe | null>(null);
  const [editedPrices, setEditedPrices] = useState<{ [productId: string]: string }>({});
  const [editedName, setEditedName] = useState("");
  const [editedUsername, setEditedUsername] = useState("");
  const [editedPassword, setEditedPassword] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleStartEdit = (cafe: Cafe) => {
    setEditingCafe(cafe);
    setEditedName(cafe.name);
    setEditedUsername(cafe.username || "");
    setEditedPassword("");
    // Initialize temporary text states for each price
    const pricesMap: { [productId: string]: string } = {};
    products.forEach((p) => {
      const price = cafe.prices[p.id] !== undefined ? cafe.prices[p.id] : p.price;
      pricesMap[p.id] = price.toString();
    });
    setEditedPrices(pricesMap);
    setSuccessMsg(null);
  };

  const handlePriceChange = (productId: string, val: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  const handleSavePrices = async () => {
    if (!editingCafe) return;
    if (!editedName.trim()) {
      alert("Le nom du café est requis.");
      return;
    }

    const finalPrices: { [productId: string]: number } = {};
    products.forEach((p) => {
      const parsed = parseFloat(editedPrices[p.id]);
      finalPrices[p.id] = isNaN(parsed) || parsed < 0 ? p.price : parsed;
    });

    try {
      await onUpdateCafe(editingCafe.id, editedName, finalPrices, editedUsername, editedPassword);
      setSuccessMsg("Tarifs et identifiants du café mis à jour avec succès !");
      setTimeout(() => setSuccessMsg(null), 3000);
      setEditingCafe(null);
    } catch (err) {
      alert("Erreur lors de la mise à jour des prix.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCafeName.trim()) return;
    try {
      await onAddCafe(newCafeName, newUsername, newPassword);
      setNewCafeName("");
      setNewUsername("");
      setNewPassword("");
      setIsAdding(false);
    } catch (err) {
      alert("Erreur lors de la création du café.");
    }
  };

  const handleDeleteClick = async (id: string, name: string) => {
    let proceed = false;
    try {
      proceed = confirm(`Êtes-vous sûr de vouloir supprimer le café "${name}" ? Ses factures resteront archivées.`);
    } catch (e) {
      proceed = true;
    }
    if (proceed) {
      try {
        await onDeleteCafe(id);
      } catch (err) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  return (
    <div className="cafe-management-page space-y-6">
      {/* Header section */}
      <AtelierHero kind="rose" eyebrow="LES AMIS DE LA MAISON" title={<>De belles <em>rencontres.</em></>} description="Nos cafés partenaires, leurs petites habitudes et leurs tarifs. Une relation qui se cultive avec soin.">
        {!editingCafe && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="btn-primary flex items-center gap-2 bg-amber-800 hover:bg-amber-900 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Café</span>
          </button>
        )}
      </AtelierHero>

      {!editingCafe && <div className="cafe-partner-note"><span className="cafe-partner-icon"><Coffee size={23} /></span><div><strong>Un accès personnel pour chaque café</strong><p>Créez ses identifiants et ses tarifs. Il pourra consulter les produits, les catalogues et passer ses commandes.</p></div><button className="btn-secondary" onClick={async () => {
        const link = new URL('/?espace=cafe', window.location.origin).href;
        try { await navigator.clipboard.writeText(link); setSuccessMsg('Lien de connexion café copié.'); }
        catch { setSuccessMsg('Lien de connexion café : ' + link); }
      }}>Copier le lien Café ↗</button></div>}

      {successMsg && (
        <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Adding form drawer */}
      {isAdding && !editingCafe && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddSubmit}
          className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 p-6 shadow-lg shadow-amber-950/5 max-w-md space-y-4"
        >
          <h3 className="font-serif text-base font-bold text-stone-900">Nouveau Café</h3>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nom de l'établissement</label>
            <input
              type="text"
              required
              value={newCafeName}
              onChange={(e) => setNewCafeName(e.target.value)}
              placeholder="Ex: Café du Jardin"
              className="w-full bg-stone-100/50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-700 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Identifiant d'accès</label>
              <input
                type="text"
                required
                minLength={3}
                pattern="[a-zA-Z0-9_.-]{3,80}"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ex: jardin"
                className="w-full bg-stone-100/50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Mot de passe</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="w-full bg-stone-100/50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="btn-primary bg-amber-800 hover:bg-amber-900 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              Créer le café
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </motion.form>
      )}

      <AnimatePresence mode="wait">
        {!editingCafe ? (
          /* List of cafes */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {cafes.map((cafe) => (
              <div
                key={cafe.id}
                className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-6 shadow-lg shadow-amber-950/2 hover:bg-white/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100/60 flex items-center justify-center text-amber-800">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-stone-900">{cafe.name}</h3>
                      <p className="text-[10px] uppercase font-mono tracking-wider text-amber-800 font-bold">
                        {Object.keys(cafe.prices || {}).length} tarifs personnalisés
                      </p>
                    </div>
                  </div>

                   <div className="text-stone-500 text-xs space-y-1.5 border-t border-stone-100/50 pt-3 mt-3">
                    <p className="font-semibold text-stone-755 mb-1 font-serif text-xs">Identifiants d'accès :</p>
                    <div className="bg-stone-50 border border-stone-200/50 rounded-xl p-2.5 space-y-1 font-mono text-[11px] text-stone-600 mb-3">
                      <div><span className="text-stone-400 font-sans">Identifiant:</span> <span className="font-bold text-stone-900">{cafe.username || "non-configuré"}</span></div>
                      <div className="text-stone-500 font-sans">Rôle Café partenaire · Accès par mot de passe</div>
                    </div>

                    <p className="font-semibold text-stone-700 mb-2 font-serif text-xs">Exemples de tarifs :</p>
                    {products.slice(0, 3).map((p) => {
                      const price = cafe.prices[p.id] !== undefined ? cafe.prices[p.id] : p.price;
                      return (
                        <div key={p.id} className="flex justify-between items-center text-[10px]">
                          <span className="truncate max-w-[150px]">{p.name}</span>
                          <span className="font-mono font-bold text-stone-850">{price.toFixed(1)} DT</span>
                        </div>
                      );
                    })}
                    {products.length > 3 && (
                      <p className="text-[10px] text-stone-400 italic text-right mt-1">... et {products.length - 3} autres douces saveurs</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-stone-100/50 pt-4 mt-5">
                  <button
                    onClick={() => handleStartEdit(cafe)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier Tarifs</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(cafe.id, cafe.name)}
                    disabled={cafe.id === "cafe_coccinelle" || cafe.id === "cafe_jasmin"}
                    title={cafe.id === "cafe_coccinelle" || cafe.id === "cafe_jasmin" ? "Cafés de démonstration non supprimables" : "Supprimer ce café"}
                    className={`p-2 rounded-xl transition-all ${
                      cafe.id === "cafe_coccinelle" || cafe.id === "cafe_jasmin"
                        ? "bg-stone-50 text-stone-300 cursor-not-allowed"
                        : "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          /* Active Café Price Matrix Editor spreadsheet grid */
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-lg shadow-amber-950/2 p-6"
          >
            {/* Header / Actions toolbar inside sheet */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/50 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingCafe(null)}
                  className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-all cursor-pointer"
                  title="Retour à la liste"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-800" />
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Édition des tarifs</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="font-serif text-xl font-bold text-stone-900 border-b border-transparent hover:border-stone-300 focus:border-amber-700 bg-transparent outline-none py-0.5 max-w-[250px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setEditingCafe(null)}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSavePrices}
                  className="btn-primary flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Sauvegarder Tarifs</span>
                </button>
              </div>
            </div>

            {/* Credentials edit block */}
            <div className="bg-stone-50 border border-stone-200/50 rounded-2xl p-5 mb-6">
              <h4 className="font-serif font-bold text-stone-900 text-sm mb-3">Identifiants de connexion au portail du café</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Identifiant (Username)</label>
                  <input
                    type="text"
                    required
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Mot de Passe (Password)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Laisser vide pour conserver"
                    value={editedPassword}
                    onChange={(e) => setEditedPassword(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-xs text-stone-900 outline-none focus:border-amber-700 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Info notice block */}
            <div className="bg-amber-50/20 backdrop-blur-sm border border-amber-200/30 rounded-xl p-3.5 text-xs text-amber-950 mb-6 flex items-start gap-2.5">
              <Info className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Bordereau dynamique de tarification :</p>
                <p className="text-stone-500 mt-0.5">
                  Saisissez les tarifs spécifiques en DT pour cet établissement. Les modifications seront prises en compte instantanément lors de l'établissement d'une nouvelle facture pour <span className="font-bold text-amber-950">{editedName}</span>. Une valeur vide ou invalide réappliquera automatiquement le tarif de base du produit.
                </p>
              </div>
            </div>

            {/* Price list grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((p) => {
                const basePrice = p.price;
                const activeVal = editedPrices[p.id] || "";
                const isCustom = activeVal !== "" && parseFloat(activeVal) !== basePrice;

                return (
                  <div
                    key={p.id}
                    className={`cafe-price-row p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isCustom
                        ? "bg-amber-50/20 border-amber-200"
                        : "bg-white border-stone-200/60"
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block font-mono">
                        {p.category}
                      </span>
                      <h4 className="font-serif font-bold text-stone-900 text-sm truncate" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        Base: <span className="font-mono font-semibold">{basePrice.toFixed(1)} DT</span>
                      </p>
                    </div>

                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={activeVal}
                        onChange={(e) => handlePriceChange(p.id, e.target.value)}
                        className="w-full text-right bg-stone-50 border border-stone-200 rounded-xl pl-2 pr-7 py-2 text-xs font-mono font-bold text-stone-850 outline-none focus:border-amber-700"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[9px] font-bold text-stone-400 uppercase font-sans">
                        DT
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
