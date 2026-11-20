import type { ReactNode } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import AtelierArt from './AtelierArt';

export default function AtelierHero({ eyebrow, title, description, children, kind = 'vanilla', welcome = false }: {
  eyebrow: string; title: ReactNode; description: string; children?: ReactNode; kind?: 'vanilla' | 'rose' | 'pistache'; welcome?: boolean;
}) {
  return <section className={`atelier-hero flavour-${kind} ${welcome ? 'is-welcome' : ''}`}>
    <div className="atelier-hero-copy"><span className="intro-kicker"><Sparkles size={13} />{eyebrow}</span><h1>{title}</h1><p>{description}</p>{children && <div className="atelier-hero-tools">{children}</div>}</div>
    <div className="atelier-hero-scene"><span className="scene-orbit" /><AtelierArt /><span className="atelier-sticker"><Heart size={12} />La touche ARIMA</span><span className="scene-caption">fait avec amour</span></div>
  </section>;
}
