import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Play, Heart, Sparkles, VolumeX, X, Coffee, Film, CakeSlice, RotateCcw } from 'lucide-react';
import AtelierArt from './AtelierArt';

const media = '/media/cafe-cinema';
const films = [
  { id: 'en-famille', title: 'Les petits bonheurs en famille', description: 'Noisette et classique : les petites bouchées se partagent.', duration: '2:11', note: 'Le petit moment gourmand', theme: 'vanilla', sticker: 'Nouveau · En famille', featured: false },
  { id: 'a-partager', title: 'À deux, c’est encore meilleur.', description: 'Fraise, Oreo, classique et noisette : une dégustation à partager.', duration: '1:04', note: 'Encore une petite bouchée ?', theme: 'rose', sticker: 'Nouveau · À partager', featured: true },
  { id: 'la-collection', title: 'Les petits bonheurs de la maison', description: 'La collection ARIMA et les petites attentions qui font plaisir.', duration: '0:33', note: 'Un peu de nous…', theme: 'vanilla', sticker: 'Bienvenue à la maison', featured: false },
  { id: 'trois-saveurs', title: 'Trois goûts. Beaucoup de sourires.', description: 'Pistache, fraise, noisette : place aux premières bouchées.', duration: '1:28', note: 'Psst… regarde ici !', theme: 'rose', sticker: 'La pause à savourer', featured: false },
  { id: 'premieres-bouchees', title: 'Le petit coup de cœur', description: 'Les saveurs se découvrent, les envies se confirment.', duration: '1:32', note: 'Ça donne envie, non ?', theme: 'pistache', sticker: 'Une bouchée de bonheur', featured: false },
];
type FilmEntry = typeof films[number];

function DrawnArrow({ className = '' }: { className?: string }) {
  return <svg className={`cinema-drawn-arrow ${className}`} viewBox="0 0 150 90" fill="none" aria-hidden="true"><path className="cinema-arrow-trail" d="M12 10C53-3 93 14 79 40C66 64 27 39 48 27C77 9 133 36 132 76" pathLength="1" /><path className="cinema-arrow-tip" d="M116 63L132 78L143 59" /></svg>;
}

function FilmCard({ film, active, allowedToPlay, onPreview, onOpen }: {
  film: FilmEntry; active: boolean; allowedToPlay: boolean; onPreview: () => void; onOpen: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!card.current || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .12 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  const running = active && allowedToPlay && visible;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (running) { element.muted = true; void element.play().catch(() => { /* The poster stays usable if autoplay is blocked. */ }); }
    else element.pause();
  }, [running]);
  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') return;
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? .4 : 1;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    card.current?.style.setProperty('--cinema-rx', `${-y * 7 * motionScale}deg`);
    card.current?.style.setProperty('--cinema-ry', `${x * 9 * motionScale}deg`);
  };
  const resetTilt = () => {
    card.current?.style.setProperty('--cinema-rx', '0deg');
    card.current?.style.setProperty('--cinema-ry', '0deg');
  };
  return <article ref={card} className={`cinema-card cinema-${film.theme} ${film.featured ? 'cinema-featured' : ''} ${running ? 'is-previewing' : ''}`}>
    <div className="cinema-card-note" aria-hidden="true"><span>{film.note}</span><DrawnArrow /></div>
    <div className="cinema-tilt">
      <button type="button" className="cinema-frame" onClick={onOpen} onPointerEnter={event => { if (event.pointerType !== 'touch') onPreview(); }} onPointerMove={tilt} onPointerLeave={resetTilt} onFocus={onPreview} onBlur={resetTilt} aria-label={`Regarder ${film.title} — ${film.duration}`}>
        <span className="cinema-tape" aria-hidden="true" />
        <span className="cinema-film-sticker"><Heart size={12} fill="currentColor" />{film.sticker}</span>
        <span className="cinema-screen">
          <img className="cinema-poster" src={`${media}/${film.id}-poster.jpg`} alt="" loading="lazy" width="540" height="960" />
          <video ref={video} className="cinema-preview" src={visible ? `${media}/${film.id}-preview.mp4` : undefined} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
          <span className="cinema-muted" aria-label="Aperçu sans son"><VolumeX size={14} /></span>
          <span className="cinema-play"><Play size={23} fill="currentColor" /><span>Voir la vidéo</span></span>
          <span className="cinema-duration">{film.duration}</span>
        </span>
        <span className="cinema-frame-caption"><span>La touche ARIMA</span><Heart size={17} /></span>
      </button>
    </div>
    <div className="cinema-card-copy"><h3>{film.title}</h3><p>{film.description}</p></div>
    <span className="cinema-card-spark cinema-spark-a" aria-hidden="true">✧</span><span className="cinema-card-spark cinema-spark-b" aria-hidden="true">✧</span>
  </article>;
}

function CinemaPlayer({ film, onClose }: { film: FilmEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    const player = video.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    void player?.play().catch(() => { /* Native controls remain available if the browser requires another gesture. */ });
    return () => {
      player?.pause(); element.close(); document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={dialog} className={`cafe-cinema-player cinema-${film.theme}`} aria-labelledby="cinema-player-title" aria-describedby="cinema-player-description" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="cinema-player-heading"><span><Film size={16} />LE PETIT CINÉMA ARIMA</span><button type="button" autoFocus className="cinema-close" aria-label="Fermer la vidéo" title="Fermer (Échap)" onClick={onClose}><X size={22} /></button></div>
    <h2 id="cinema-player-title">{film.title}</h2>
    <div className="cinema-player-stage"><video ref={video} src={`${media}/${film.id}.mp4`} poster={`${media}/${film.id}-poster.jpg`} controls autoPlay playsInline preload="metadata" onError={() => setFailed(true)} aria-label={film.title} />
      {failed && <div className="cinema-player-error" role="alert"><CakeSlice size={26} /><p>La vidéo n’a pas pu se charger.</p><button className="btn-secondary" onClick={() => { setFailed(false); video.current?.load(); void video.current?.play().catch(() => setFailed(true)); }}><RotateCcw size={16} />Réessayer</button><a href={`${media}/${film.id}.mp4`} download>Télécharger la vidéo</a></div>}
    </div>
    <p id="cinema-player-description" className="cinema-player-description">{film.description}</p>
  </dialog>, document.body);
}

export default function CafeCinema({ onExplore }: { onExplore?: () => void }) {
  const [active, setActive] = useState('a-partager');
  const [selected, setSelected] = useState<FilmEntry | null>(null);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const close = useCallback(() => setSelected(null), []);
  useEffect(() => {
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <section className="cafe-cinema" aria-labelledby="cafe-cinema-title" data-atelier-reveal>
    <div className="cinema-heading"><div><span className="cinema-kicker"><Film size={15} />LE PETIT CINÉMA ARIMA</span><h2 id="cafe-cinema-title">Ça se savoure aussi<br /><em>avec les yeux.</em><svg viewBox="0 0 350 20" aria-hidden="true"><path d="M5 13Q150 1 340 10M35 18Q198 6 308 16" /></svg></h2><p>Les créations de la maison, les premières bouchées et les petits coups de cœur. Installez-vous, on vous montre.</p></div><div className="cinema-companion" aria-hidden="true"><AtelierArt compact /><span>À regarder<br />avec un café…</span><Coffee size={22} /></div></div>
    <div className={films.length === 5 ? "cinema-board cinema-board-expanded" : "cinema-board"}>{films.map(film => <FilmCard key={film.id} film={film} active={active === film.id} allowedToPlay={tabVisible && !selected} onPreview={() => setActive(film.id)} onOpen={() => setSelected(film)} />)}</div>
    <div className="cinema-footer"><span className="cinema-footer-note"><Sparkles size={18} />Attention, ça donne envie !</span><a className="cinema-music-credit" href={`${media}/MUSIC-CREDITS.txt`} target="_blank" rel="noreferrer">Crédits musicaux</a>{onExplore && <button type="button" className="cinema-explore" onClick={onExplore}><CakeSlice size={17} />Choisir mes douceurs</button>}</div>
    {selected && <CinemaPlayer film={selected} onClose={close} />}
  </section>;
}
