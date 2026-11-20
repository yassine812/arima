import { illustratedProductPhotos } from './illustratedProducts';

const preparedLayers = new Set(Object.keys(illustratedProductPhotos));
export function productForeground(product: { id: string; image?: string }, displayedPhoto?: string) {
  if (!preparedLayers.has(product.id) || displayedPhoto !== illustratedProductPhotos[product.id]) return undefined;
  return `/products/layers/${product.id}.webp`;
}
