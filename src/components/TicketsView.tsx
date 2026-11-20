import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, Scissors, Eye, X, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import collections from '../ticketCollections.json';
import merged from '../ticketMerge.json';
type TicketFile = typeof collections[number];
type FlavourDesign = { id: string; name: string; preview: string; color: string; ink: string };
const designsFor = (file: TicketFile): FlavourDesign[] => (file as TicketFile & { designs?: FlavourDesign[] }).designs || [];
function TicketPreview({ file, onClose, initialPage = 0 }: { file: TicketFile; onClose: () => void; initialPage?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const element = dialog.current!; const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  return createPortal(<dialog ref={dialog} className="ticket-reader" aria-label={file.title} onCancel={event => { event.preventDefault();onClose(); }} onClick={event => { if(event.target === event.currentTarget) onClose(); }}>
    <div className="ticket-reader-tools"><span><strong>{file.title}</strong><small>{file.modelCount} modèles distincts · {file.dimensions} · A4</small></span><a href={file.pdf} download={file.filename} className="btn-primary"><Download size={16}/><span>PDF</span></a><a href={file.print} target="_blank" rel="noreferrer" className="btn-secondary"><Printer size={16}/><span>Imprimer</span></a><button className="icon-button" aria-label="Fermer les tickets" onClick={onClose}><X size={21}/></button></div>
    <img className="ticket-reader-page" src={file.pageImages[page]} alt={`${file.title}, page ${page + 1} sur ${file.pages}`}/>
    <div className="ticket-reader-navigation"><button aria-label="Page précédente" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={20}/></button><span>Page {page + 1} sur {file.pages}</span><button aria-label="Page suivante" disabled={page === file.pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={20}/></button><a href={file.pdf} target="_blank" rel="noreferrer" aria-label="Ouvrir le PDF des tickets"><ArrowUpRight size={18}/></a></div>
  </dialog>, document.body);
}
export default function TicketsView() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<TicketFile | null>(null);
  const [miniFlavour, setMiniFlavour] = useState('pistache');
  const [selectedPage, setSelectedPage] = useState(0);
  const openFile = (file: TicketFile) => {
    const flavourIndex = designsFor(file).findIndex(design => design.id === miniFlavour);
    setSelectedPage(flavourIndex < 0 ? 0 : Math.floor(flavourIndex / 2));
    setSelected(file);
  };
  const files = collections.filter(file => filter === 'all' || file.group === filter);
  return <section className="tickets-view">
    <header className="tickets-heading"><span className="eyebrow"><Scissors size={14}/> LES TICKETS DE LA MAISON</span><h1>Vos tickets <em>ARIMA.</em></h1><p>Quatre tickets par goût. Deux goûts sur la même page lorsque le format le permet.</p><span className="tickets-format-note">Taille des tickets conservée · sans goûts en double · mini tiramisus séparés</span><a className="btn-primary tickets-merged-download" href={merged.pdf} download={merged.filename}><Download size={16}/>Tous les tickets réunis · {merged.pages} pages</a></header>
    <div className="tickets-filters" aria-label="Types de tickets">{[['all','Tous les tickets'],['rectangles','Tickets illustrés'],['tiramisu','Bandelettes tiramisu'],['mini','Mini tiramisus']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<span>{collections.filter(f=>id==='all'||f.group===id).length}</span></button>)}</div>
    <div className="tickets-file-grid">{files.map(file=>{
      const designs=designsFor(file);
      const current=designs.find(design=>design.id===miniFlavour);
      return <article className="tickets-file" key={file.id}>
      <button className={`tickets-file-preview ${file.group==='mini'?'is-mini-design':''}`} onClick={()=>openFile(file)} aria-label={`Voir ${file.title}`}><span className="tickets-original-tag">{file.tag}</span><img src={current?.preview || file.preview} alt={file.group==='mini'?`Illustration du mini tiramisu ${current?.name || ''}`:`Première page : ${file.title}`} loading="lazy"/><span className="tickets-open-label"><Eye size={14}/>Voir les {file.pages} planches</span></button>
      {designs.length>0&&<div className="tickets-flavour-choices"><p>Explorez les 10 univers.</p><div role="group" aria-label="Illustration de la saveur mini">{designs.map(design=><button key={design.id} aria-pressed={miniFlavour===design.id} onClick={()=>setMiniFlavour(design.id)} style={{background:design.color,color:design.ink}}>{design.name}</button>)}</div></div>}
      <div className="tickets-file-info"><div><h2>{file.title}</h2><span>{file.pages} pages</span></div><p>{file.description}</p><small>{file.dimensions} · A4 · taille réelle</small><div className="tickets-file-actions"><button className="btn-primary" onClick={()=>openFile(file)}><Eye size={15}/>Voir les tickets</button><a className="btn-secondary" href={file.pdf} download={file.filename} aria-label={`Télécharger ${file.title}`}><Download size={15}/>PDF</a><a className="btn-secondary" href={file.print} target="_blank" rel="noreferrer" aria-label={`Imprimer ${file.title}`}><Printer size={15}/>Imprimer</a></div></div>
    </article>;})}</div>
    <p className="tickets-print-hint"><Scissors size={14}/>Pour conserver la taille des tickets : imprimer à 100 % / taille réelle.</p>
    {selected&&<TicketPreview file={selected} initialPage={selectedPage} onClose={()=>setSelected(null)}/>}
  </section>;
}
