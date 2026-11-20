import { PageFlip } from 'page-flip';
import editions from './catalogueVersions.json';
import './catalogue-reader.css';

const version = Number(new URLSearchParams(location.search).get('v'));
const catalogue = editions.find(edition => edition.version === version) ?? editions[editions.length - 1];
document.querySelector<HTMLAnchorElement>('#error a')!.href = catalogue.pdf;

const reader = document.querySelector<HTMLElement>('#reader')!;
const host = document.querySelector<HTMLElement>('#book-host')!;
const counter = document.querySelector<HTMLElement>('#counter')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const controls = Object.fromEntries(['first', 'previous', 'next', 'last'].map(id => [id, document.getElementById(id) as HTMLButtonElement]));
let book: PageFlip | undefined;
let ready = false;
let turning = false;

function refresh() {
  if (!book || !ready) return;
  const current = book.getCurrentPageIndex();
  const portrait = book.getOrientation() === 'portrait';
  const end = current === 0 || portrait ? current + 1 : Math.min(current + 2, catalogue.pageCount);
  counter.textContent = end === current + 1 ? `Page ${current + 1} sur ${catalogue.pageCount}` : `Pages ${current + 1}–${end} sur ${catalogue.pageCount}`;
  reader.dataset.page = String(current + 1);
  reader.dataset.orientation = portrait ? 'portrait' : 'landscape';
  for (const id of ['first', 'previous']) controls[id].disabled = turning || current === 0;
  for (const id of ['next', 'last']) controls[id].disabled = turning || end >= catalogue.pageCount;
  // PageFlip reserves a left-hand slot for a closed cover. Move that slot off
  // centre so the actual single page sits in the middle of the screen.
  const halfPage = book.getBoundsRect().pageWidth / 2;
  const lastSinglePage = current === catalogue.pageCount - 1 && catalogue.pageCount % 2 === 0;
  const shift = portrait ? 0 : current === 0 ? -halfPage : lastSinglePage ? halfPage : 0;
  host.style.setProperty('--cover-shift', `${shift}px`);
}

function navigate(direction: 'first' | 'previous' | 'next' | 'last') {
  if (!book || !ready || turning || controls[direction].disabled) return;
  if (direction === 'next') book.flipNext('bottom');
  else if (direction === 'previous') book.flipPrev('bottom');
  else book.turnToPage(direction === 'first' ? 0 : catalogue.pageCount - 1);
  refresh();
}
Object.entries(controls).forEach(([direction, button]) => button.addEventListener('click', () => navigate(direction as 'first' | 'previous' | 'next' | 'last')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { window.parent.postMessage('arima-catalogue-close', location.origin); return; }
  const direction = ({ ArrowLeft: 'previous', ArrowRight: 'next', Home: 'first', End: 'last' } as const)[event.key];
  if (direction) { event.preventDefault(); navigate(direction); }
});
reader.addEventListener('click', event => {
  if (event.target === reader || (event.target as HTMLElement).classList.contains('book-stage')) {
    window.parent.postMessage('arima-catalogue-close', location.origin);
  }
});

async function initialize() {
  const pages = catalogue.pages.map(page => {
    const element = document.createElement('div');
    element.className = 'book-page';
    element.dataset.pageNumber = String(page.number);
    const image = document.createElement('img');
    image.src = page.src;
    image.alt = `Page ${page.number} : ${page.label}`;
    image.draggable = false;
    element.append(image);
    host.append(element);
    return element;
  });
  await Promise.all(pages.map(page => page.querySelector('img')!.decode()));
  book = new PageFlip(host, {
    width: 450, height: 636.396, size: 'stretch', minWidth: 200, maxWidth: 700, minHeight: 100, maxHeight: 990,
    startPage: 0, drawShadow: true, flippingTime: 900, usePortrait: true, showCover: true,
    autoSize: false, maxShadowOpacity: .38, mobileScrollSupport: true, showPageCorners: true,
    clickEventForward: true, useMouseEvents: true, swipeDistance: 35, disableFlipByClick: false,
  });
  book.on('init', () => {
    ready = true; loading.hidden = true;
    refresh(); window.parent.postMessage('arima-catalogue-ready', location.origin);
  });
  book.on('flip', refresh);
  book.on('changeOrientation', refresh);
  book.on('changeState', event => { turning = event.data === 'flipping'; reader.dataset.turning = String(turning); refresh(); });
  book.loadFromHTML(pages);
  new ResizeObserver(() => { book?.update(); refresh(); }).observe(host);
}

initialize().catch(() => { loading.hidden = true; document.querySelector<HTMLElement>('#error')!.hidden = false; window.parent.postMessage('arima-catalogue-error', location.origin); });
