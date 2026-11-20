import { illustratedProductPhotos } from './illustratedProducts';

export function productPhoto(product: { id: string; image?: string }) {
  if (product.image?.startsWith('data:image/') || product.image?.startsWith('https://') || product.image?.startsWith('/')) return product.image;
  return illustratedProductPhotos[product.id];
}
