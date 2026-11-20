import { useEffect, type ReactNode } from 'react';

export function AtelierMotion({ children, viewKey }: { children: ReactNode; viewKey: string }) {
  useEffect(() => {
    const root = document.getElementById('atelier-main');
    if (!root || !('IntersectionObserver' in window)) return;
    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('has-arrived');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px 30px 0px' });
    const discover = () => root.querySelectorAll<HTMLElement>('.surface, .metric-card, .product-card, .invoice-summary > div, [data-atelier-reveal], [class*="backdrop-blur"]').forEach(element => {
      const surface = element.closest('.surface');
      if (observed.has(element) || element.closest('.print-card') || (surface && surface !== element)) return;
      observed.add(element);
      element.style.setProperty('--reveal-delay', `${Math.min(Array.from(element.parentElement?.children || []).indexOf(element) * 45, 180)}ms`);
      element.classList.add('atelier-reveal');
      observer.observe(element);
    });
    discover();
    const mutations = new MutationObserver(discover);
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect(); mutations.disconnect();
      root.querySelectorAll('.atelier-reveal').forEach(element => { element.classList.remove('atelier-reveal'); element.classList.add('has-arrived'); });
    };
  }, [viewKey]);
  useEffect(() => {
    const onVisibility = () => { document.documentElement.dataset.tabHidden = String(document.hidden); };
    onVisibility(); document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return <main id="atelier-main" className="atelier-view" data-view={viewKey} key={viewKey}>{children}</main>;
}
