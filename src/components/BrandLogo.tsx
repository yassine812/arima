export default function BrandLogo({ mark = false, className = '' }: { mark?: boolean; className?: string }) {
  return <span className={`brand-logo ${mark ? 'brand-mark' : ''} ${className}`}>
    <span className="brand-logo-art"><img src={mark ? '/brand/arima-mark-v2.png' : '/brand/arima-logo-v2.png'} alt="ARIMA — Pâtisserie" draggable={false} /></span>
    {!mark && <><span className="brand-glint brand-glint-one" aria-hidden="true" /><span className="brand-glint brand-glint-two" aria-hidden="true" /></>}
  </span>;
}
