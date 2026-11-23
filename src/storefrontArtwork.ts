import type { ShopProduct } from './storefrontTypes';
import type { Product } from './types';
/** The public shop displays each product's own Converty photo. */
export function shopArtwork(product: ShopProduct): Product {
  return { id: product.id, name: product.name, category: product.category, description: product.description, price: product.price, image: product.image };
}
