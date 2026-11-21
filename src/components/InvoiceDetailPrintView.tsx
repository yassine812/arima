import React from "react";
import { ArrowLeft, Printer, Download, Check, Clock, ShieldAlert, Award, FileText } from "lucide-react";
import { Invoice } from "../types";
import BrandLogo from './BrandLogo';

interface InvoiceDetailPrintViewProps {
  invoice: Invoice;
  onBack: () => void;
  onMarkAsPaid?: (id: string) => Promise<void>;
}

export default function InvoiceDetailPrintView({
  invoice,
  onBack,
  onMarkAsPaid,
}: InvoiceDetailPrintViewProps) {
  
  // Detect if running inside the preview iframe, where browsers limit/block window.print()
  const isInsideIframe = typeof window !== "undefined" && window.self !== window.top;

  // Launch standard print dialog
  const handlePrint = () => {
    window.print();
  };

  const formatDT = (val: number) => {
    if (val === undefined || val === null) return "0,000 DT";
    return val.toLocaleString("fr-TN", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + " DT";
  };

  const isBakeryKgItem = (name: string) => {
    const n = name.toLowerCase();
    return n.includes("kg") || n.includes("baklawa") || n.includes("kaak") || n.includes("samsa");
  };

  return (
    <div className="invoice-detail-page space-y-6 font-sans">
      {/* Upper bar with non-printable action headers */}
      <div className="invoice-detail-toolbar no-print bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 p-4 shadow-lg shadow-amber-950/2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            aria-label="Retour" onClick={onBack}
            className="p-2 hover:bg-stone-100 rounded-xl border border-stone-200 text-stone-600 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-serif text-sm font-semibold text-stone-900">Facture {invoice.invoiceNumber}</h1>
            <p className="text-[11px] text-stone-400">Générez une impression papier A4 ou exportez directement en PDF.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status !== "paid" && onMarkAsPaid && (
            <button
              onClick={() => onMarkAsPaid(invoice.id)}
              className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marquer comme Payée</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 duration-100"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer / PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* PDF Export instruction alert */}
      {isInsideIframe && (
        <div className="no-print bg-amber-50/70 border-2 border-amber-500/30 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-2.5 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-1">Avis important pour le mode Aperçu :</span>
            Vous naviguez actuellement à l'intérieur de l'aperçu sécurisé de l'éditeur (Iframe). Les fonctions d'impression du navigateur et de téléchargement PDF peuvent être restreintes par les protections de votre navigateur.
            <div className="mt-2 text-stone-900 font-medium">
              👉 Pour imprimer ou exporter votre facture sans contrainte, veuillez cliquer sur l'icône <span className="font-bold">"Ouvrir dans un nouvel onglet"</span> en haut à droite de l'aperçu de l'application (ou utiliser le lien direct de votre projet).
            </div>
          </div>
        </div>
      )}

      <details className="mobile-print-help no-print"><summary>Enregistrer la facture en PDF</summary><p>Appuyez sur « Imprimer / PDF », puis choisissez « Enregistrer en PDF » ou l’option de partage de votre téléphone. Le document conserve son format A4.</p></details>
      <div className="desktop-print-help no-print bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-xs text-stone-700 flex items-start gap-2.5">
        <FileText className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Configuration :</span> Lors de l'ouverture de l'imprimante, choisissez l'imprimante virtuelle <span className="font-semibold text-stone-950">"Enregistrer au format PDF"</span> (ou <span className="font-semibold text-stone-950">"Save as PDF"</span>). Nous avons configuré une règle CSS pour masquer automatiquement les en-têtes (Google AI Studio) et les pieds de page (liens). Si certains s'affichent encore, veillez à décocher la case <span className="font-semibold text-stone-950">"En-têtes et pieds de page"</span> (Headers and footers) dans les options de votre imprimante ou navigateur.
        </div>
      </div>

      {/* Printable Invoice Page Container (Matches standard elegant enterprise letterhead) */}
      <div className="print-card bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-md max-w-4xl mx-auto text-stone-800 relative select-text">
        
        {/* Invoice Header (Logo, Date, Café name) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-stone-250 pb-6 gap-4">
          {/* Arima Logo (optional) */}
          <BrandLogo className="invoice-brand" />

          {/* Date & Café Name */}
          <div className="text-left sm:text-right space-y-1 font-sans text-xs">
            <div>
              <span className="text-stone-400 font-medium">Date :</span>{" "}
              <span className="font-bold text-stone-900 font-mono">
                {new Date(invoice.date).toLocaleDateString("fr-FR")}
              </span>
            </div>
            <div>
              <span className="text-stone-400 font-medium">Café :</span>{" "}
              <span className="font-bold text-stone-900">
                {invoice.cafeName || invoice.customerName}
              </span>
            </div>
            <div className="text-[10px] text-stone-400 font-mono">
              Facture N°: {invoice.invoiceNumber}
            </div>
          </div>
        </div>

        {/* Product table */}
        <div className="py-6">
          <table className="invoice-items-table w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-300 text-[10px] font-bold text-stone-605 uppercase tracking-wider">
                <th className="py-2 pb-3">Produit</th>
                <th className="py-2 pb-3 text-center w-24">Quantité</th>
                <th className="py-2 pb-3 text-right w-36">Prix unitaire</th>
                <th className="py-2 pb-3 text-right w-36">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.items?.map((item, idx) => {
                const itemBrut = item.price * item.quantity;
                return (
                  <tr key={idx} className="hover:bg-stone-50/40">
                    <td data-label="Produit" className="py-3 font-semibold text-stone-850">
                      {item.name}
                    </td>
                    <td data-label="Quantité" className="py-3 text-center font-mono font-medium text-stone-800">
                      {item.quantity}
                    </td>
                    <td data-label="Prix unitaire" className="py-3 text-right font-mono text-stone-600">
                      {formatDT(item.price)}
                    </td>
                    <td data-label="Total" className="py-3 text-right font-mono font-bold text-stone-900">
                      {formatDT(itemBrut)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex flex-col items-end pt-4 border-t border-stone-200">
          <div className="w-full sm:w-80 space-y-3 font-sans text-xs">
            {/* Total quantity of products */}
            <div className="flex justify-between items-center text-stone-600">
              <span className="font-medium">Quantité totale de produits :</span>
              <span className="font-mono font-black text-sm text-stone-800">
                {invoice.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
              </span>
            </div>

            {/* Grand total in DT */}
            <div className="flex justify-between items-center bg-amber-50/50 p-3 rounded-xl border border-amber-100">
              <span className="font-bold text-amber-900">Total Général (DT) :</span>
              <span className="font-serif text-lg font-extrabold text-amber-950 font-mono">
                {formatDT(invoice.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
