import type { CSSProperties } from 'react';
import type { Ingredient } from './IngredientGlyph';
type PaintedIngredient = Ingredient | 'wafer' | 'leaf';
const atlas: Record<PaintedIngredient, [number, number]> = {
  coffee: [0,0], chocolate: [1,0], oreo: [2,0], speculos: [3,0], cinnamon: [3,0],
  pistachio: [0,1], hazelnut: [1,1], almond: [2,1], coconut: [3,1],
  strawberry: [0,2], raspberry: [1,2], lemon: [2,2], caramel: [3,2],
  wafer: [0,3], cream: [1,3], leaf: [2,3], biscuit: [3,3],
};

export function ingredientsForProduct(id: string): PaintedIngredient[] {
  if (/pistache/.test(id)) return ['pistachio', 'pistachio', 'cream', 'pistachio', 'biscuit', 'pistachio'];
  if (/framboise/.test(id)) return ['raspberry', 'cream', 'raspberry', 'biscuit', 'raspberry', 'raspberry'];
  if (/fraise/.test(id)) return ['strawberry', 'biscuit', 'strawberry', 'cream', 'strawberry', 'strawberry'];
  if (/citron/.test(id)) return ['lemon', 'cream', 'lemon', 'biscuit', 'lemon', 'lemon'];
  if (/rafaello/.test(id)) return ['coconut', 'almond', 'cream', 'coconut', 'almond', 'coconut'];
  if (/kinder/.test(id)) return ['wafer', 'hazelnut', 'chocolate', 'wafer', 'hazelnut', 'cream'];
  if (/noisette/.test(id)) return ['hazelnut', 'cream', 'hazelnut', 'biscuit', 'hazelnut', 'hazelnut'];
  if (/speculos/.test(id)) return ['speculos', 'cinnamon', 'speculos', 'biscuit', 'cream', 'speculos'];
  if (/oreo/.test(id)) return ['oreo', 'chocolate', 'oreo', 'cream', 'oreo', 'biscuit'];
  if (/caramel/.test(id)) return ['caramel', 'chocolate', 'caramel', 'biscuit', 'cream', 'caramel'];
  if (/classique/.test(id)) return ['coffee', 'biscuit', 'coffee', 'cream', 'coffee', 'chocolate'];
  return ['chocolate', 'cream', 'chocolate', 'biscuit', 'chocolate', 'chocolate'];
}

export default function ProductIngredients({ id }: { id: string }) {
  const recipe = ingredientsForProduct(id);
  const ingredients = recipe;
  return <span className="product-ingredients" aria-hidden="true">{ingredients.map((kind, index) => {
    const [column,row] = atlas[kind];
    return <span className={`ingredient-background ingredient-background-${index + 1}`} key={index} style={{ '--float-delay': `${-index * 3}s`, '--float-duration': `${22 + index * 2}s` } as CSSProperties} data-ingredient={kind}>
      <span className="painted-ingredient" style={{ backgroundPosition: `${column * 100 / 3}% ${row * 100 / 3}%` }} />
    </span>;
  })}</span>;
}

