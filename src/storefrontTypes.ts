export interface ShopVariant { id: string; label: string; price: number; available: boolean }
export interface ShopProduct {
  id: string; name: string; slug: string; description: string; image: string;
  category: string; price: number; comparePrice?: number; available: boolean;
  variants: ShopVariant[]; maxQuantity: number; externalOnly: boolean;
}
export interface ShopCatalog {
  connected: true; name: string; currency: string; decimals: number;
  cities: string[]; products: ShopProduct[];
}
export interface CartSelection { productId: string; quantity: number; variantId?: string }
export interface ShopQuote {
  id: string; expiresAt: number; currency: string;
  items: (CartSelection & { name: string; variantLabel?: string; unitPrice: number; total: number; image: string })[];
  subtotal: number; delivery: number; total: number;
}
export interface ShopReceipt {
  reference: number; webReference: string; currency: string; subtotal: number; delivery: number;
  total: number; items: ShopQuote['items']; receivedAt: string;
}
export interface ShopCustomer { name: string; phone: string; city: string; address: string; note?: string; email?: string }
