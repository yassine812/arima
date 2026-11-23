import type { ShopProduct } from './storefrontTypes';
import type { Product } from './types';
import { illustratedProductPhotos } from './illustratedProducts';

/** Only verified family/flavour matches use our painted assets. Other SKUs keep their own Converty photo. */
export function shopArtwork(product: ShopProduct): Product {
  const value = `${product.slug} ${product.name}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const family = /cheesecake/.test(value) ? 'cheese' : /tiramisu/.test(value) ? (/mini/.test(value) ? 'mini_tira' : 'tira') : '';
  const flavours: [RegExp, string][] = [[/oreo.*choc|choc.*oreo/, 'oreo_choc'], [/kinder.*bueno|bueno/, 'kinder'], [/specul|specol|specol|speculo|speculoos|speculos/, 'speculos'], [/raffa?ello|rafaello/, 'rafaello'], [/pistache/, 'pistache'], [/framboise/, 'framboise'], [/fraise/, 'fraise'], [/noisette/, 'noisette'], [/classique/, 'classique'], [/citron/, 'citron'], [/caramel/, 'caramel'], [/oreo/, 'oreo'], [/chocolat/, 'chocolat'], [/kids/, 'kids']];
  const flavour = flavours.find(([pattern]) => pattern.test(value))?.[1];
  const key = family && flavour ? `${family}_${flavour}` : '';
  const matched = !!illustratedProductPhotos[key];
  return { id: matched ? key : product.id, name: product.name, category: product.category, description: product.description, price: product.price, image: matched ? '' : product.image };
}
