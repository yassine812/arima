declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, string | number | boolean>);
    on(event: string, handler: (event: { data: unknown; object: PageFlip }) => void): PageFlip;
    loadFromHTML(pages: HTMLElement[]): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    flip(page: number, corner?: 'top' | 'bottom'): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getOrientation(): 'portrait' | 'landscape';
    getBoundsRect(): { left: number; top: number; width: number; height: number; pageWidth: number };
    getState(): string;
    getSettings(): Record<string, string | number | boolean> & { minWidth: number };
    update(): void;
    destroy(): void;
  }
}
