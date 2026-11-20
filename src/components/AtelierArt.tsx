import { useEffect, useRef } from 'react';

/** A small, hand-drawn companion for the atelier. All decoration is silent. */
export default function AtelierArt({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const illustration = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || !illustration.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      illustration.current?.setAttribute('data-art-visible', String(entry.isIntersecting));
    }, { rootMargin: '30px' });
    observer.observe(illustration.current);
    return () => observer.disconnect();
  }, []);
  return <svg ref={illustration} data-art-visible="true" className={`atelier-art ${compact ? 'is-compact' : ''} ${className}`} viewBox="0 0 400 300" fill="none" aria-hidden="true">
    <ellipse cx="206" cy="266" rx="114" ry="15" fill="#C49379" opacity=".13" className="art-shadow" />
    <path d="M54 187C17 136 59 51 130 37C198 4 320 40 352 111C394 190 310 269 217 260C126 284 69 246 54 187Z" fill="#F7D8B7" opacity=".56" />
    <path d="M69 238C117 262 289 280 345 223" stroke="#C59275" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 9" opacity=".5" />
    <g className="art-cake" stroke="#754B39" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M97 150L227 98L315 145L183 204L97 150Z" fill="#FFF5DF" />
      <path d="M97 150V215Q97 226 110 230L180 260Q185 262 191 259L307 205Q315 201 315 192V145L183 204L97 150Z" fill="#F1C495" />
      <path d="M98 172L182 221L315 162V180L183 239L98 194V172Z" fill="#9B6346" />
      <path d="M98 194L183 239L315 180V192L183 251L98 208V194Z" fill="#FFF0D6" stroke="none" />
      <path d="M97 150L183 190L315 133V151L183 211L97 169V150Z" fill="#FFF6E2" />
      <path d="M97 151Q100 138 114 133L222 87Q228 84 236 88L307 124Q323 132 310 140L191 193Q184 196 178 193L97 157V151Z" fill="#FFDAD4" />
      <path d="M106 150L181 182Q186 185 193 182L301 135" stroke="#FFF8EA" strokeWidth="5" strokeLinecap="round" />
      <path d="M170 115Q178 93 191 105Q203 76 218 102Q232 90 242 112Q252 120 240 127L209 140Q201 144 192 140L172 130Q162 125 170 115Z" fill="#FFF9EB" />
      <g className="art-cherry"><path d="M208 100Q207 75 227 65" stroke="#6F8650" strokeWidth="3" strokeLinecap="round" /><path d="M215 78Q216 60 238 67Q234 81 215 78Z" fill="#A9BD7A" stroke="#6F8650" strokeWidth="2" /><circle cx="206" cy="103" r="15" fill="#D57B7C" /><path d="M200 95L198 99" stroke="#FFE6DC" strokeWidth="4" strokeLinecap="round" /></g>
      <g className="art-face" stroke="#754B39" strokeLinecap="round"><path d="M124 189V194M157 206V211" strokeWidth="4" /><path d="M135 204Q141 213 147 209" strokeWidth="2.5" /><ellipse cx="115" cy="196" rx="7" ry="4" fill="#E99C8C" stroke="none" /><ellipse cx="167" cy="218" rx="7" ry="4" fill="#E99C8C" stroke="none" /></g>
      <path d="M194 219L297 173M196 244L302 194" stroke="#C59267" strokeWidth="1.5" strokeDasharray="2 6" />
    </g>
    <g className="art-spark art-spark-one" stroke="#B67B59" strokeWidth="2" strokeLinecap="round"><path d="M77 78L81 89L92 93L81 97L77 108L73 97L62 93L73 89L77 78Z" fill="#FFFAE9" /><path d="M107 54V64M102 59H112" /></g>
    <g className="art-spark art-spark-two" stroke="#A07952" strokeWidth="2" strokeLinecap="round"><path d="M335 172L339 182L349 186L339 190L335 200L331 190L321 186L331 182L335 172Z" fill="#FFFAE9" /><path d="M348 140V150M343 145H353" /></g>
    <g className="art-leaf"><path d="M306 68Q337 34 356 55Q345 83 306 68Z" fill="#A7B879" stroke="#71864E" strokeWidth="2" /><path d="M306 68L345 57" stroke="#71864E" strokeWidth="2" strokeLinecap="round" /></g>
    <g className="art-heart" stroke="#B56A67" strokeWidth="2"><path d="M67 185C47 164 35 186 51 197L69 207L77 189C83 170 67 168 67 185Z" fill="#EDB0A4" /></g>
    <circle cx="283" cy="52" r="4" fill="#D9967E" /><circle cx="100" cy="235" r="4" fill="#AFBA80" /><circle cx="341" cy="225" r="3" fill="#D9967E" />
  </svg>;
}
