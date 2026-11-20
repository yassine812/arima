import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, Printer, LoaderCircle, X, ArrowUpRight, CalendarDays, Archive } from 'lucide-react';
import editions from '../catalogueVersions.json';

type Edition = typeof editions[number];
const savedDate = (date: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date(date));

function CatalogueModal({ edition, onClose }: { edition: Edition; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reader = useRef<HTMLIFrameElement>(null);
  const printFrame = useRef<HTMLIFrameElement>(null);
  const printReady = useRef(false);
  const printRequested = useRef(false);
  const [loading, setLoading] = useState(true);
  const [printMounted, setPrintMounted] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    const message = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source === reader.current?.contentWindow) {
        if (event.data === 'arima-catalogue-ready' || event.data === 'arima-catalogue-error') setLoading(false);
        if (event.data === 'arima-catalogue-close') onClose();
      }
      if (event.source !== printFrame.current?.contentWindow) return;
      if (event.data === 'arima-catalogue-print-ready') {
        printReady.current = true; setPrinting(false);
        if (printRequested.current) { printRequested.current = false; printFrame.current?.contentWindow?.postMessage('arima-print-catalogue', window.location.origin); }
      }
      if (event.data === 'arima-catalogue-print-finished') setPrinting(false);
      if (event.data === 'arima-catalogue-print-error') { setPrinting(false); setError('L’impression n’a pas pu être préparée. Ouvrez la version imprimable.'); }
    };
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [onClose]);
  function print() {
    setError('');
    if (printReady.current) printFrame.current?.contentWindow?.postMessage('arima-print-catalogue', window.location.origin);
    else { printRequested.current = true; setPrinting(true); setPrintMounted(true); }
  }
  return createPortal(<dialog ref={dialog} className="catalogue-modal" aria-labelledby="catalogue-modal-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="catalogue-modal-inner">
      <h2 id="catalogue-modal-title" className="sr-only">Le catalogue ARIMA — Version {edition.version}</h2>
        <div className="catalogue-floating-actions" role="group" aria-label="Actions du catalogue">
          <a className="btn-primary" href={edition.pdf} download={`ARIMA_Catalogue_V${edition.version}.pdf`}><Download size={16} /><span>Télécharger le PDF</span></a>
          <button className="btn-secondary" onClick={print} disabled={printing}>{printing ? <LoaderCircle size={16} className="catalogue-spinner" /> : <Printer size={16} />}{printing ? 'Préparation…' : 'Imprimer'}</button>
        </div>
      <button autoFocus className="catalogue-modal-close" onClick={onClose} aria-label="Fermer le catalogue" title="Fermer (Échap)"><X size={21} /></button>
      <div className="catalogue-modal-reader">
        {loading && <div className="catalogue-loading" role="status"><LoaderCircle size={20} className="catalogue-spinner" />Ouverture du catalogue…</div>}
        <iframe ref={reader} src={`/catalogue-reader.html?v=${edition.version}`} title="Feuilleter les pages du catalogue ARIMA" className="catalogue-book-frame" />
      </div>
      {error && <p className="catalogue-print-error" role="alert">{error} <a href={edition.print} target="_blank" rel="noopener noreferrer">Version imprimable</a></p>}
      {printMounted && <iframe ref={printFrame} src={edition.print} title="Préparation de l’impression du catalogue" className="catalogue-print-frame" tabIndex={-1} aria-hidden="true" />}
    </div>
  </dialog>, document.body);
}

export default function CatalogueBookView() {
  const [selected, setSelected] = useState<Edition | null>(null);
  return <div className="catalogue-book-page">
    <div className="catalogue-book-heading"><div><span className="intro-kicker"><Archive size={14} />LA BIBLIOTHÈQUE ARIMA</span><h1>Nos catalogues.</h1><p>Nos douceurs, au fil des éditions. Choisissez un carnet à feuilleter.</p></div><span className="catalogue-paper-badge"><BookOpen size={17} />{editions.length} édition{editions.length > 1 ? 's' : ''} conservée{editions.length > 1 ? 's' : ''}</span></div>
    <div className="catalogue-editions">{[...editions].reverse().map(edition => <article className="catalogue-edition" key={edition.version}>
      <button className="catalogue-cover-button" onClick={() => setSelected(edition)} aria-label={`Ouvrir le catalogue version ${edition.version}`}><span className="catalogue-edition-tag">VERSION {edition.version}</span><span className="catalogue-cover-book"><img src={edition.pages[0].src} alt={`Couverture du catalogue ARIMA, version ${edition.version}`} /></span><span className="catalogue-cover-open"><BookOpen size={16} />Feuilleter le catalogue <ArrowUpRight size={17} /></span></button>
      <div className="catalogue-edition-info"><div className="catalogue-edition-title"><h2>Le catalogue ARIMA</h2><span>{edition.pageCount} pages</span></div><p><CalendarDays size={12} /><span>Enregistré le <time dateTime={edition.savedAt}>{savedDate(edition.savedAt)}</time></span></p><div className="catalogue-edition-actions"><button onClick={() => setSelected(edition)}><BookOpen size={14} />Ouvrir le livre</button><a href={edition.pdf} download={`ARIMA_Catalogue_V${edition.version}.pdf`} aria-label={`Télécharger le PDF de la version ${edition.version}`}><Download size={14} />PDF</a></div></div>
    </article>)}</div>
    {selected && <CatalogueModal edition={selected} onClose={() => setSelected(null)} />}
  </div>;
}
