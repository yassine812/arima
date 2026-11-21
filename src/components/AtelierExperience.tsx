import { useEffect, useRef, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

const cardSelector = '.atelier-hero, .atelier-page-heading, .product-card, .metric-card, .surface, .invoice-product-pick, #atelier-main [class*="backdrop-blur"]';

/** Always-on motion is the owner's explicit preference for this application. */
export default function AtelierExperience({ children }: { children: ReactNode }) {
  const pointerLayer = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const bursts = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = pointerLayer.current;
    if (!layer || typeof layer.showPopover !== 'function') return;
    // Native modal dialogs live above every ordinary z-index. Keep the decorative
    // pointer in a manual popover, and raise it again whenever a dialog opens.
    const raise = () => {
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
    };
    raise();
    const dialogs = new MutationObserver(changes => {
      if (changes.some(change => change.target instanceof HTMLDialogElement)) raise();
    });
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => { dialogs.disconnect(); if (layer.matches(':popover-open')) layer.hidePopover(); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.atelierMotion = 'always';
    delete document.documentElement.dataset.ambientMotion;
    try { localStorage.removeItem('arima-ambient-paused'); } catch { /* No storage is required for motion. */ }
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let card: HTMLElement | null = null;
    let button: HTMLElement | null = null;
    let targetX = 0, targetY = 0;
    let target: Element | null = null;
    let visible = false;
    const particles = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    const burst = (event: MouseEvent) => {
      if (event.button !== 0 || !bursts.current || !finePointer.matches || window.innerWidth < 768) return;
      const bounds = event.target instanceof Element ? event.target.getBoundingClientRect() : null;
      const x = event.detail === 0 && bounds ? bounds.left + bounds.width / 2 : event.clientX;
      const y = event.detail === 0 && bounds ? bounds.top + bounds.height / 2 : event.clientY;
      for (let index = 0; index < 8; index++) {
        while (particles.size >= 40) {
          const oldest = particles.keys().next().value!;
          clearTimeout(particles.get(oldest)); oldest.remove(); particles.delete(oldest);
        }
        const element = document.createElement('span');
        const image = document.createElement('img');
        const dessert = index % 2 ? 'cheesecake' : 'tiramisu';
        element.className = 'dessert-pop';
        element.dataset.dessert = dessert;
        element.style.left = `${x}px`; element.style.top = `${y}px`;
        element.style.setProperty('--pop-size', `${21 + Math.random() * 12}px`);
        element.style.setProperty('--pop-x', `${(index - 3.5) * 33 + (Math.random() - .5) * 16}px`);
        element.style.setProperty('--pop-rise', `${-65 - Math.random() * 75}px`);
        element.style.setProperty('--pop-end-y', `${25 + Math.random() * 75}px`);
        element.style.setProperty('--pop-rotation', `${(Math.random() - .5) * 280}deg`);
        image.src = `/brand/motion/${dessert}.svg`; image.alt = ''; image.draggable = false;
        element.append(image); bursts.current.append(element);
        particles.set(element, setTimeout(() => { element.remove(); particles.delete(element); }, 1500));
      }
    };
    const resetCard = () => {
      if (!card) return;
      card.classList.remove('is-pointer-hover');
      for (const name of ['--pointer-rx', '--pointer-ry', '--parallax-x', '--parallax-y', '--scene-x', '--scene-y']) card.style.removeProperty(name);
      card = null;
    };
    const resetButton = () => {
      button?.style.removeProperty('--magnetic-x'); button?.style.removeProperty('--magnetic-y'); button = null;
    };
    const render = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (target && !target.isConnected) { resetCard(); resetButton(); target = null; }
      // Keep the arrow tip on the actual click position, including over controls.
      if (cursor.current) cursor.current.style.transform = `translate3d(${targetX}px,${targetY}px,0)`;
      // Pointer geometry is sampled once per frame, without triggering React renders.
      const nextCard = target?.closest<HTMLElement>(cardSelector) || null;
      if (nextCard !== card) {
        resetCard(); card = nextCard;
        if (card && !card.closest('.print-card')) {
          card.classList.add('pointer-reactive', 'is-pointer-hover');
          const flavour = card.querySelector<HTMLElement>('.product-visual');
          cursor.current?.style.setProperty('--cursor-accent', flavour ? getComputedStyle(flavour).getPropertyValue('--flavour-accent') : '#D2A28A');
        }
        else card = null;
      }
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (targetX - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (targetY - rect.top) / rect.height * 2 - 1));
        const intensity = card.matches('.atelier-hero, .surface') ? 2 : 4;
        card.style.setProperty('--pointer-rx', `${-y * intensity}deg`);
        card.style.setProperty('--pointer-ry', `${x * intensity}deg`);
        card.style.setProperty('--pointer-x', `${(x + 1) * 50}%`);
        card.style.setProperty('--pointer-y', `${(y + 1) * 50}%`);
        card.style.setProperty('--parallax-x', `${x * 7}px`);
        card.style.setProperty('--parallax-y', `${y * 7}px`);
        card.style.setProperty('--scene-x', `${x * 13}px`);
        card.style.setProperty('--scene-y', `${y * 9}px`);
      }
      const nextButton = target?.closest<HTMLElement>('button:not(:disabled), a') || null;
      if (nextButton !== button) { resetButton(); button = nextButton; }
      cursor.current?.classList.toggle('is-over-action', !!button);
      if (button) {
        const rect = button.getBoundingClientRect();
        button.classList.add('cursor-button');
        button.style.setProperty('--magnetic-x', `${Math.max(-3, Math.min(3, (targetX - rect.left - rect.width / 2) * .06))}px`);
        button.style.setProperty('--magnetic-y', `${Math.max(-3, Math.min(3, (targetY - rect.top - rect.height / 2) * .06))}px`);
      }
    };
    const hide = () => {
      visible = false; cursor.current?.classList.remove('is-visible');
      delete document.documentElement.dataset.dessertCursor;
      if (frame) cancelAnimationFrame(frame); frame = 0;
      resetCard(); resetButton();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !finePointer.matches || window.innerWidth < 768) { hide(); return; }
      target = event.target instanceof Element ? event.target : null;
      targetX = event.clientX; targetY = event.clientY;
      visible = true;
      document.documentElement.dataset.dessertCursor = 'ready';
      cursor.current?.classList.add('is-visible');
      cursor.current?.classList.toggle('is-interactive', !!target?.closest('button,a,input,select,textarea'));
      if (!frame) frame = requestAnimationFrame(render);
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('click', burst, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('visibilitychange', hide);
    return () => {
      hide();
      particles.forEach((timer, element) => { clearTimeout(timer); element.remove(); });
      particles.clear();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('click', burst);
      document.documentElement.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide); window.removeEventListener('scroll', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  return <MotionConfig reducedMotion="never" transition={{ type: 'spring', stiffness: 210, damping: 25 }}>
    {children}
    <div ref={pointerLayer} popover="manual" className="atelier-pointer-layer no-print" aria-hidden="true">
      <div ref={cursor} className="atelier-cursor no-print" aria-hidden="true"><img className="cursor-dessert" src="/brand/motion/tiramisu-arrow.svg" alt="" draggable={false} /></div>
      <div ref={bursts} className="dessert-bursts no-print" aria-hidden="true" />
    </div>
  </MotionConfig>;
}
