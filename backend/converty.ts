import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Express, Request, Response, NextFunction } from 'express';
import type { CartSelection, ShopCatalog, ShopCustomer, ShopProduct, ShopQuote, ShopReceipt } from '../src/storefrontTypes';

type StoreDB = { db: { prepare(sql: string): { get(...args: any[]): any; run(...args: any[]): any } } };
type Vendor = Record<string, any>;
export interface ConvertyOptions { encryptionKey?: string; origin?: string; expectedStoreId?: string; fetcher?: typeof fetch; now?: () => number }
const API = 'https://api.converty.shop/api/v1';
const PARTNER = 'https://partner.converty.shop';
export const CONVERTY_SCOPES = ['read-stores', 'read-products', 'create-orders'];
const PREFIX = 'converty:';
const SHOP_COOKIE = 'arima_shop';
const idPattern = /^[a-f\d]{24}$/i;
const attemptPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export class ShopError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message); }
}
const issue = (status: number, code: string, message: string): never => { throw new ShopError(status, code, message); };
const clean = (value: unknown, label: string, max = 200, optional = false) => {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) return issue(400, 'INVALID_INPUT', `${label} invalide.`);
  return value.trim();
};
const amount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) return issue(503, 'CATALOG_INVALID', 'Les tarifs ne sont pas disponibles. Réessayez plus tard.');
  return Math.round((value + Number.EPSILON) * 1000);
};
const cookie = (req: Request, name: string) => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1);
const plainText = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 800) : '';
const image = (p: Vendor) => {
  const src = p.images?.[0]?.md || p.images?.[0]?.lg || '';
  try { const url = new URL(src); return url.protocol === 'https:' ? src : ''; } catch { return ''; }
};
const stockAllows = (p: Vendor, variant: Vendor | undefined, quantity: number) => {
  if (!p.trackStock) return true;
  const stock = variant?.stock || p.newStock;
  if (stock?.continueSellingWhenOutOfStock) return true;
  if (stock?.outOfStock) return false;
  const available = stock?.quantity ?? (!variant ? p.stock : undefined);
  // A tracked product with no readable stock is never offered as unlimited.
  return typeof available === 'number' && Number.isFinite(available) && available >= quantity;
};
const sellable = (p: Vendor) => p.status === 'shown' && !p.isDeleted;
const variantLabel = (p: Vendor, variant: Vendor) => (p.options || []).map((opt: Vendor, index: number) => {
  const value = opt.values?.find((v: Vendor) => v.id === variant.selectedValues?.[index]);
  return value ? `${opt.name} : ${value.value}` : '';
}).filter(Boolean).join(' · ');

/** Only the public allowlist is returned to shoppers. Vendor costs, owner data and tokens stay server-side. */
export function publicProduct(p: Vendor, categories: Map<string, string>): ShopProduct {
  const variants = Array.isArray(p.newVariants) ? p.newVariants : [];
  const externalOnly = !!(p.hasActiveCoupon || p.variants?.length || p.bundles?.options?.length
    || (p.options?.length && !variants.length));
  return {
    id: p._id, name: String(p.name || '').slice(0, 200), slug: String(p.slug || ''), description: plainText(p.description), image: image(p),
    category: (p.categories || []).map((id: string) => categories.get(id)).filter(Boolean)[0] || 'Les créations',
    price: amount(p.price) / 1000, comparePrice: typeof p.comparePrice === 'number' ? amount(p.comparePrice) / 1000 : undefined,
    available: sellable(p) && (variants.length ? variants.some((v: Vendor) => stockAllows(p, v, 1)) : stockAllows(p, undefined, 1)),
    maxQuantity: p.allowQuantityButton === false ? 1 : 50, externalOnly,
    variants: variants.map((v: Vendor) => ({ id: String(v.id), label: variantLabel(p, v), price: amount(v.price) / 1000, available: stockAllows(p, v, 1) })),
  };
}
export function selections(value: unknown): CartSelection[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) return issue(400, 'INVALID_CART', 'Choisissez entre une et vingt créations.');
  const result = new Map<string, CartSelection>();
  for (const raw of value) {
    if (!raw || !idPattern.test(raw.productId) || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 50
      || (raw.variantId !== undefined && (typeof raw.variantId !== 'string' || raw.variantId.length > 200))) return issue(400, 'INVALID_CART', 'Votre sélection est invalide.');
    const key = `${raw.productId}:${raw.variantId || ''}`;
    const entry = result.get(key) || { productId: raw.productId, quantity: 0, ...(raw.variantId ? { variantId: raw.variantId } : {}) };
    entry.quantity += raw.quantity;
    if (entry.quantity > 50) issue(400, 'INVALID_CART', 'Limite de cinquante pièces par création.');
    result.set(key, entry);
  }
  return [...result.values()].sort((a, b) => `${a.productId}:${a.variantId || ''}`.localeCompare(`${b.productId}:${b.variantId || ''}`));
}

export class ConvertyCommerce {
  private context = new AsyncLocalStorage<number>();
  private key?: Buffer;
  private readonly now: () => number;
  private readonly fetcher: typeof fetch;
  private readonly origin: string;
  private readonly expectedStoreId: string;
  private catalogCache?: { until: number; store: Vendor; products: Vendor[]; categories: Map<string, string> };
  private catalogFlight?: Promise<NonNullable<ConvertyCommerce['catalogCache']>>;
  private refreshFlight?: Promise<string>;
  constructor(private store: StoreDB, options: ConvertyOptions = {}) {
    const secret = options.encryptionKey ?? process.env.CONVERTY_ENCRYPTION_KEY;
    if (secret) { this.key = Buffer.from(secret, 'base64'); if (this.key.length !== 32) throw new Error('CONVERTY_ENCRYPTION_KEY must be 32 random bytes encoded as base64.'); }
    this.origin = options.origin || process.env.PUBLIC_SITE_ORIGIN || 'https://arima-eight.vercel.app';
    if (new URL(this.origin).origin !== this.origin) throw new Error('PUBLIC_SITE_ORIGIN must be an origin without a path.');
    this.expectedStoreId = options.expectedStoreId || process.env.CONVERTY_STORE_ID || '69e9d7c9fef2de95043ee3ba';
    this.fetcher = options.fetcher || fetch; this.now = options.now || Date.now;
  }
  private requireKey() { return this.key || issue(503, 'CONNECTION_NOT_READY', 'La boutique est en cours de connexion.'); }
  private hash(value: string) { return createHmac('sha256', this.requireKey()).update(value).digest('hex'); }
  private encrypt(value: unknown) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.requireKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), encrypted.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  }
  private decrypt(value: string) {
    const [version, iv, encrypted, tag] = value.split('.');
    if (version !== 'v1') throw new Error('Unsupported encrypted integration record.');
    const decipher = createDecipheriv('aes-256-gcm', this.requireKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
  }
  private async raw(key: string): Promise<string | undefined> { return (await this.store.db.prepare('SELECT value FROM metadata WHERE key=?').get(PREFIX + key))?.value as string | undefined; }
  private async get(key: string) { const value = await this.raw(key); return value ? this.decrypt(value) : undefined; }
  private async put(key: string, value: unknown) { await this.store.db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(PREFIX + key, this.encrypt(value)); }
  private async remove(key: string) { await this.store.db.prepare('DELETE FROM metadata WHERE key=?').run(PREFIX + key); }
  private async insert(key: string, value: unknown) {
    const encoded = this.encrypt(value);
    await this.store.db.prepare('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run(PREFIX + key, encoded);
    return await this.raw(key) === encoded;
  }
  private async swap(key: string, expected: string, value: unknown) {
    const encoded = this.encrypt(value);
    await this.store.db.prepare('UPDATE metadata SET value=? WHERE key=? AND value=?').run(encoded, PREFIX + key, expected);
    return await this.raw(key) === encoded;
  }
  private async limit(req: Request, action: string, maximum: number, window: number) {
    const key = `rate:${action}:${this.hash(req.ip || 'local')}`;
    for (let tries = 0; tries < 4; tries++) {
      const raw = await this.raw(key); const old = raw ? this.decrypt(raw) : undefined;
      const current = old && old.until > this.now() ? { ...old, count: old.count + 1 } : { until: this.now() + window, count: 1 };
      if (current.count > maximum) issue(429, 'RATE_LIMIT', 'Un instant, s’il vous plaît. Réessayez dans quelques minutes.');
      if (raw ? await this.swap(key, raw, current) : await this.insert(key, current)) return;
    }
    issue(429, 'RATE_LIMIT', 'La boutique est très sollicitée. Réessayez dans un instant.');
  }
  private owner(req: Request) {
    const value = cookie(req, SHOP_COOKIE);
    return value && /^[a-f\d]{64}$/.test(value) ? this.hash(value) : issue(400, 'CART_SESSION', 'Rechargez la page pour ouvrir votre panier.');
  }
  private ensureCookie(req: Request, res: Response) {
    if (!cookie(req, SHOP_COOKIE)?.match(/^[a-f\d]{64}$/)) res.cookie(SHOP_COOKIE, randomBytes(32).toString('hex'), { httpOnly: true, secure: this.origin.startsWith('https:'), sameSite: 'lax', path: '/api/boutique', maxAge: 86400000 });
  }
  private checkOrigin(req: Request) {
    if (req.headers.origin !== this.origin) issue(403, 'ORIGIN', 'Origine non autorisée.');
  }
  private async credentials() { return await this.get('credentials') || issue(503, 'CONVERTY_NOT_CONNECTED', 'La connexion à notre boutique se prépare.'); }
  private signal() {
    const remaining = (this.context.getStore() ?? Date.now() + 10000) - Date.now();
    if (remaining < 100) issue(503, 'CONVERTY_UNAVAILABLE', 'La boutique met du temps à répondre. Réessayez dans un instant.');
    return AbortSignal.timeout(Math.min(10000, remaining));
  }
  private async tokenRequest(body: Record<string, string>) {
    const credentials = await this.credentials();
    let response: globalThis.Response;
    try { response = await this.fetcher(`${PARTNER}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, client_id: credentials.clientId, client_secret: credentials.clientSecret }), signal: this.signal() }); }
    catch { return issue(503, 'CONVERTY_UNAVAILABLE', 'La connexion à la boutique est momentanément indisponible.'); }
    if (!response.ok) return issue(503, 'CONVERTY_RECONNECT', 'La boutique doit être reconnectée par son administrateur.');
    const data = await response.json() as Vendor;
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) return issue(503, 'CONVERTY_RECONNECT', 'La réponse de connexion est invalide.');
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: this.now() + data.expires_in * 1000 };
  }
  private async accessToken(force = false): Promise<string> {
    const tokens = await this.get('tokens');
    if (!tokens || tokens.invalid) return issue(503, 'CONVERTY_NOT_CONNECTED', 'La boutique est en cours de connexion.');
    if (!force && tokens.expiresAt > this.now() + 300000) return tokens.accessToken;
    if (this.refreshFlight) return this.refreshFlight;
    this.refreshFlight = this.refreshToken(force).finally(() => { this.refreshFlight = undefined; });
    return this.refreshFlight;
  }
  private async refreshToken(force: boolean): Promise<string> {
    const leaseKey = 'refresh-lease'; const previous = await this.raw(leaseKey);
    if (previous && this.decrypt(previous).until > this.now()) return issue(503, 'CONVERTY_BUSY', 'La connexion se renouvelle. Réessayez dans un instant.');
    const lease = { owner: randomUUID(), until: this.now() + 20000 };
    const won = previous ? await this.swap(leaseKey, previous, lease) : await this.insert(leaseKey, lease);
    if (!won) return issue(503, 'CONVERTY_BUSY', 'La connexion se renouvelle. Réessayez dans un instant.');
    try {
      const latest = await this.get('tokens');
      if (!force && latest.expiresAt > this.now() + 300000) return latest.accessToken;
      const next = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: latest.refreshToken });
      await this.put('tokens', next); return next.accessToken;
    } finally {
      const current = await this.raw(leaseKey);
      if (current && this.decrypt(current).owner === lease.owner) await this.store.db.prepare('DELETE FROM metadata WHERE key=? AND value=?').run(PREFIX + leaseKey, current);
    }
  }
  private async request(path: string, method = 'GET', body?: unknown): Promise<Vendor> {
    let token = await this.accessToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: globalThis.Response;
      try { response = await this.fetcher(API + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: this.signal() }); }
      catch { return issue(503, method === 'POST' ? 'ORDER_UNCERTAIN' : 'CONVERTY_UNAVAILABLE', 'La boutique met du temps à répondre.'); }
      if (response.status === 401 && attempt === 0) { token = await this.accessToken(true); continue; }
      if (!response.ok) {
        if (method === 'POST' && response.status >= 500) return issue(503, 'ORDER_UNCERTAIN', 'La réception doit être vérifiée avant une nouvelle tentative.');
        return issue(response.status === 429 ? 429 : 503, method === 'POST' ? 'ORDER_REJECTED' : 'CONVERTY_UNAVAILABLE', response.status === 429 ? 'La boutique est très sollicitée. Réessayez dans quelques minutes.' : 'La boutique ne peut pas traiter cette demande pour le moment.');
      }
      let result: Vendor;
      try { result = await response.json() as Vendor; } catch { return issue(503, method === 'POST' ? 'ORDER_UNCERTAIN' : 'CONVERTY_UNAVAILABLE', 'La réponse de la boutique doit être vérifiée.'); }
      if (result.success === false) return issue(503, method === 'POST' ? 'ORDER_REJECTED' : 'CONVERTY_UNAVAILABLE', 'La boutique n’a pas accepté la demande.');
      return result;
    }
    return issue(503, 'CONVERTY_RECONNECT', 'La boutique doit être reconnectée.');
  }
  private validateStore(info: Vendor) {
    if (info?._id !== this.expectedStoreId || info.slug !== 'arima') issue(403, 'WRONG_STORE', 'Cette connexion ne correspond pas à la boutique ARIMA attendue.');
    if (info.currency?.code !== 'TND' || info.country?.code !== 'TN') issue(503, 'STORE_CONFIGURATION', 'La devise et le pays de la boutique doivent être vérifiés.');
    return info;
  }
  private async catalogData() {
    if (this.catalogCache && this.catalogCache.until > this.now()) return this.catalogCache;
    if (this.catalogFlight) return this.catalogFlight;
    this.catalogFlight = (async () => {
      const [info, categories] = await Promise.all([this.request('/stores/me'), this.request('/categories')]);
      const store = this.validateStore(info.data);
      const products: Vendor[] = [];
      for (let page = 1; page <= 25; page++) {
        const batch = await this.request(`/products?limit=200&page=${page}&status=shown&deleted=false`);
        if (!Array.isArray(batch.data)) issue(503, 'CATALOG_INVALID', 'Notre collection se recharge. Réessayez dans un instant.');
        products.push(...batch.data.filter((p: Vendor) => p.store === this.expectedStoreId && sellable(p)));
        if (batch.data.length < 200 || page * 200 >= batch.count) break;
        if (page === 25) issue(503, 'CATALOG_LIMIT', 'La collection doit être vérifiée par son administrateur.');
      }
      const categoryNames = new Map<string, string>((Array.isArray(categories.data) ? categories.data : []).filter((c: Vendor) => c.status !== 'hidden').map((c: Vendor) => [c._id, String(c.name)]));
      return this.catalogCache = { until: this.now() + 60000, store, products, categories: categoryNames };
    })().finally(() => { this.catalogFlight = undefined; });
    return this.catalogFlight;
  }
  async catalog(): Promise<ShopCatalog> {
    const data = await this.catalogData();
    return { connected: true, name: data.store.name, currency: 'TND', decimals: 3, cities: Array.isArray(data.store.country?.subdivisions) ? data.store.country.subdivisions.filter((c: unknown) => typeof c === 'string') : [], products: data.products.map(p => publicProduct(p, data.categories)) };
  }
  private async calculate(items: CartSelection[], owner: string) {
    const catalog = await this.catalogData();
    const lines: ShopQuote['items'] = []; const vendorLines: Vendor[] = []; const shipping: number[] = []; const costs: number[] = []; const forced: number[] = [];
    // Bounded concurrency: stay within Converty's per-store request budget.
    const resolved: Vendor[] = [];
    for (let offset = 0; offset < items.length; offset += 3) {
      resolved.push(...await Promise.all(items.slice(offset, offset + 3).map(async item => {
        const listed = catalog.products.find(p => p._id === item.productId);
        if (!listed || publicProduct(listed, catalog.categories).externalOnly) return issue(409, 'PRODUCT_CHANGED', 'Une création nécessite une sélection sur la boutique. Actualisez votre panier.');
        return (await this.request(`/products/${item.productId}`)).data;
      })));
    }
    items.forEach((item, index) => {
      const p = resolved[index];
      if (!p || p.store !== this.expectedStoreId || !sellable(p)) issue(409, 'PRODUCT_CHANGED', 'Une création n’est plus disponible. Actualisez votre panier.');
      const exposed = publicProduct(p, catalog.categories);
      if (exposed.externalOnly || item.quantity > exposed.maxQuantity) issue(409, 'PRODUCT_CHANGED', 'Les options de cette création ont changé. Actualisez votre panier.');
      const variant = item.variantId ? p.newVariants?.find((v: Vendor) => v.id === item.variantId) : undefined;
      if ((p.newVariants?.length && !variant) || (item.variantId && !variant)) issue(400, 'INVALID_VARIANT', 'Choisissez le format de votre création.');
      if (!stockAllows(p, variant, item.quantity)) issue(409, 'OUT_OF_STOCK', `${p.name} n’est pas disponible dans cette quantité.`);
      let unit = amount(variant?.price ?? p.price);
      if (!variant && Array.isArray(p.discounts)) for (const tier of [...p.discounts].sort((a, b) => a.quantity - b.quantity)) {
        if (Number.isInteger(tier.quantity) && tier.quantity > 0 && item.quantity >= tier.quantity) unit = Math.min(unit, amount(tier.price));
      }
      const delivery = amount(variant?.deliveryPrice ?? p.deliveryPrice);
      shipping.push(delivery); costs.push(amount(variant?.deliveryCost ?? p.deliveryCost ?? 0));
      if (p.forceDeliveryPrice) forced.push(delivery);
      lines.push({ ...item, name: p.name, ...(variant ? { variantLabel: variantLabel(p, variant) } : {}), image: image(p), unitPrice: unit / 1000, total: unit * item.quantity / 1000 });
      vendorLines.push({ product: p._id, quantity: item.quantity, pricePerUnit: unit / 1000, ...(variant ? { selectedVariantsId: variant.id, selectedVariants: p.options.map((opt: Vendor, i: number) => ({ name: opt.name, type: opt.type, value: opt.values.find((v: Vendor) => v.id === variant.selectedValues[i])?.value })) } : {}) });
    });
    // ARIMA currently has one flat product delivery charge. Do not guess a carrier/weight rule.
    const deliveryValues = forced.length ? forced : shipping;
    if (new Set(deliveryValues).size !== 1) issue(409, 'DELIVERY_REVIEW', 'Les frais de livraison de cette sélection nécessitent une vérification sur la boutique.');
    const delivery = deliveryValues[0]; const subtotal = lines.reduce((sum, line) => sum + amount(line.total), 0);
    if (!Number.isSafeInteger(subtotal) || subtotal > 1000000000) issue(400, 'INVALID_CART', 'Le montant du panier est trop élevé.');
    const quote: ShopQuote = { id: randomUUID(), expiresAt: this.now() + 600000, currency: 'TND', items: lines, subtotal: subtotal / 1000, delivery: delivery / 1000, total: (subtotal + delivery) / 1000 };
    const requiredFields = (catalog.store.checkout?.fields || []).filter((field: Vendor) => field.required).map((field: Vendor) => field.name);
    if (requiredFields.some((field: string) => !['name', 'phone', 'city', 'address', 'note', 'email'].includes(field))) issue(409, 'DELIVERY_REVIEW', 'Cette commande nécessite une précision supplémentaire sur la boutique Converty.');
    return { owner, quote, vendorLines, deliveryCost: Math.max(...costs) / 1000, cities: catalog.store.country?.subdivisions || [], requiredFields };
  }
  private compareQuotes(a: ShopQuote, b: ShopQuote) { return JSON.stringify([a.items, a.subtotal, a.delivery, a.total]) === JSON.stringify([b.items, b.subtotal, b.delivery, b.total]); }
  private customer(value: unknown, cities: string[]): ShopCustomer {
    const c = value as Vendor;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return issue(400, 'INVALID_CUSTOMER', 'Renseignez vos coordonnées.');
    const result = { name: clean(c.name, 'Nom'), phone: clean(c.phone, 'Téléphone', 30).replace(/[\s().-]/g, ''), city: clean(c.city, 'Ville', 100), address: clean(c.address, 'Adresse', 500), note: clean(c.note, 'Note', 1000, true), email: clean(c.email, 'Email', 200, true) };
    if (!/^(?:\+?216)?[2-9]\d{7}$/.test(result.phone)) issue(400, 'INVALID_CUSTOMER', 'Indiquez un numéro tunisien valide à huit chiffres.');
    if (cities.length && !cities.includes(result.city)) issue(400, 'INVALID_CUSTOMER', 'Choisissez votre ville dans la liste.');
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) issue(400, 'INVALID_CUSTOMER', 'Vérifiez votre adresse email.');
    return result;
  }
  private jobKey(attemptKey: unknown) { if (typeof attemptKey !== 'string' || !attemptPattern.test(attemptKey)) return issue(400, 'INVALID_ATTEMPT', 'La référence de commande est invalide.'); return `order:${this.hash(attemptKey)}`; }
  private jobResponse(job: Vendor, res: Response) {
    if (job.status === 'confirmed') return res.json({ confirmed: true, receipt: job.receipt });
    if (job.status === 'rejected') return res.status(409).json({ error: 'La commande n’a pas été acceptée. Vous pouvez vérifier votre panier.', code: 'ORDER_REJECTED', rejected: true });
    return res.status(202).json({ pending: true, webReference: job.attemptKey, message: 'La réception de votre commande est en cours de vérification. Ne passez pas une deuxième commande.' });
  }
  private handle(fn: (req: Request, res: Response) => Promise<unknown>) {
    return (req: Request, res: Response, _next: NextFunction) => { void this.context.run(Date.now() + 24000, () => fn(req, res)).catch(error => {
      if (error instanceof ShopError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
      // Never log remote response bodies, customer input or OAuth credentials.
      console.error('Converty integration request failed:', error instanceof Error ? error.name : 'unknown');
      return res.status(503).json({ error: 'La boutique est momentanément indisponible.', code: 'SHOP_UNAVAILABLE' });
    }); };
  }
  mountPublic(app: Express) {
    app.get('/api/boutique/catalog', this.handle(async (req, res) => {
      this.ensureCookie(req, res); await this.limit(req, 'catalog', 90, 60000); res.json(await this.catalog());
    }));
    app.post('/api/boutique/quote', this.handle(async (req, res) => {
      this.checkOrigin(req); const owner = this.owner(req); await this.limit(req, 'quote', 30, 3600000);
      const result = await this.calculate(selections(req.body.items), owner); await this.put(`quote:${result.quote.id}`, result); res.json(result.quote);
    }));
    app.post('/api/boutique/order-status', this.handle(async (req, res) => {
      this.checkOrigin(req); const owner = this.owner(req); await this.limit(req, 'status', 90, 60000);
      const job = await this.get(this.jobKey(req.body.attemptKey));
      if (!job || job.owner !== owner) issue(404, 'ORDER_NOT_FOUND', 'Cette commande est introuvable dans votre panier.');
      return this.jobResponse(job, res);
    }));
    app.post('/api/boutique/orders', this.handle(async (req, res) => {
      this.checkOrigin(req); const owner = this.owner(req); const jobKey = this.jobKey(req.body.attemptKey);
      const items = selections(req.body.items); const cartSignature = JSON.stringify(items);
      const previous = await this.get(jobKey);
      if (previous) {
        if (previous.owner !== owner || previous.cartSignature !== cartSignature) issue(409, 'ATTEMPT_CONFLICT', 'Cette référence correspond à une autre sélection.');
        return this.jobResponse(previous, res);
      }
      await this.limit(req, 'orders', 8, 3600000);
      const saved = attemptPattern.test(req.body.quoteId || '') ? await this.get(`quote:${req.body.quoteId}`) : undefined;
      if (!saved || saved.owner !== owner || saved.quote.expiresAt <= this.now() || JSON.stringify(saved.quote.items.map(({ productId, quantity, variantId }: CartSelection) => ({ productId, quantity, ...(variantId ? { variantId } : {}) }))) !== cartSignature) issue(409, 'QUOTE_EXPIRED', 'Vérifiez le total de votre panier avant de valider.');
      const current = await this.calculate(items, owner);
      if (!this.compareQuotes(saved.quote, current.quote)) {
        await this.put(`quote:${current.quote.id}`, current);
        throw new ShopError(409, 'PRICE_CHANGED', 'Les tarifs de votre sélection ont changé. Vérifiez le nouveau total avant de confirmer.', { quote: current.quote });
      }
      const customer = this.customer(req.body.customer, current.cities);
      for (const field of current.requiredFields) if (!customer[field as keyof ShopCustomer]) issue(400, 'INVALID_CUSTOMER', `Renseignez le champ ${field}.`);
      const job = { owner, cartSignature, attemptKey: req.body.attemptKey, status: 'sending', startedAt: this.now(), quote: current.quote };
      if (!await this.insert(jobKey, job)) {
        const other = await this.get(jobKey);
        if (other.owner !== owner || other.cartSignature !== cartSignature) issue(409, 'ATTEMPT_CONFLICT', 'Cette référence est déjà utilisée.');
        return this.jobResponse(other, res);
      }
      // Commit the claim before calling the non-idempotent upstream API. Never replay an uncertain POST.
      try {
        const result = await this.request('/orders', 'POST', { customer, cart: current.vendorLines, total: { totalPrice: current.quote.total, deliveryPrice: current.quote.delivery, deliveryCost: current.deliveryCost }, status: 'pending', note: `ARIMA web · ${req.body.attemptKey}` });
        if (!Number.isInteger(result.data?.reference) || result.data.reference < 1) throw new ShopError(503, 'ORDER_UNCERTAIN', 'La référence reçue doit être vérifiée.');
        if (result.data.total && (amount(result.data.total.totalPrice) !== amount(current.quote.total) || amount(result.data.total.deliveryPrice) !== amount(current.quote.delivery))) throw new ShopError(503, 'ORDER_UNCERTAIN', 'Le total reçu doit être vérifié par ARIMA.');
        const receipt: ShopReceipt = { reference: result.data.reference, webReference: req.body.attemptKey, currency: 'TND', subtotal: current.quote.subtotal, delivery: current.quote.delivery, total: current.quote.total, items: current.quote.items, receivedAt: new Date(this.now()).toISOString() };
        await this.put(jobKey, { ...job, status: 'confirmed', receipt });
        res.status(201).json({ confirmed: true, receipt });
      } catch (error) {
        const definitive = error instanceof ShopError && error.code === 'ORDER_REJECTED';
        // Persistence can fail after the vendor accepted the order. The original 'sending' claim still prevents duplicates.
        try { await this.put(jobKey, { ...job, status: definitive ? 'rejected' : 'uncertain' }); } catch { /* keep original claim */ }
        if (definitive) return this.jobResponse({ ...job, status: 'rejected' }, res);
        return this.jobResponse(job, res);
      }
    }));
    app.get('/api/converty/callback', this.handle(async (req, res) => {
      res.setHeader('Referrer-Policy', 'no-referrer');
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const nonce = cookie(req, 'arima_converty_oauth');
      const stateKey = attemptPattern.test(state) ? `oauth:${state}` : '';
      const raw = stateKey ? await this.raw(stateKey) : undefined; const saved = raw ? this.decrypt(raw) : undefined;
      if (!saved || saved.used || saved.until < this.now() || !nonce || saved.nonce !== this.hash(nonce)) issue(400, 'OAUTH_STATE', 'La connexion a expiré. Recommencez depuis l’espace administrateur.');
      if (!await this.swap(stateKey, raw!, { used: true })) issue(400, 'OAUTH_STATE', 'Cette connexion a déjà été utilisée.');
      res.clearCookie('arima_converty_oauth', { path: '/api/converty/callback', sameSite: 'lax', secure: this.origin.startsWith('https:') });
      if (req.query.error || typeof req.query.code !== 'string' || req.query.code.length > 3000) return res.redirect(303, `${this.origin}/espace?connexion=converty-refusee`);
      const credentials = await this.credentials();
      if (credentials.clientId !== saved.clientId) issue(400, 'OAUTH_STATE', 'La configuration a changé. Recommencez la connexion.');
      const tokens = await this.tokenRequest({ grant_type: 'authorization_code', code: req.query.code, redirect_uri: `${this.origin}/api/converty/callback` });
      // Validate the exact store before persisting any usable connection.
      const response = await this.fetcher(`${API}/stores/me`, { headers: { Authorization: `Bearer ${tokens.accessToken}` }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) issue(503, 'CONVERTY_RECONNECT', 'La boutique n’a pas pu être vérifiée.');
      const info = this.validateStore((await response.json() as Vendor).data);
      await this.put('tokens', tokens); await this.put('profile', { id: info._id, name: info.name, slug: info.slug, connectedAt: this.now() });
      this.catalogCache = undefined;
      return res.redirect(303, `${this.origin}/espace?connexion=converty`);
    }));
  }
  mountAdmin(app: Express, admin: (req: Request, res: Response, next: NextFunction) => unknown) {
    app.get('/api/converty/status', admin, this.handle(async (_req, res) => {
      const credentials = this.key ? await this.get('credentials') : undefined;
      const tokens = this.key ? await this.get('tokens') : undefined;
      res.json({ ready: !!this.key, configured: !!credentials, connected: !!tokens && !tokens.invalid, clientId: credentials?.clientId || '', profile: this.key ? await this.get('profile') : undefined, callback: `${this.origin}/api/converty/callback`, scopes: CONVERTY_SCOPES });
    }));
    app.post('/api/converty/config', admin, this.handle(async (req, res) => {
      this.requireKey(); const clientId = clean(req.body.clientId, 'Identifiant de l’application', 300); const clientSecret = clean(req.body.clientSecret, 'Secret serveur', 3000);
      if (clientSecret.length < 8) issue(400, 'INVALID_SECRET', 'Le secret serveur est invalide.');
      await this.put('credentials', { clientId, clientSecret }); await this.remove('tokens'); await this.remove('profile'); this.catalogCache = undefined;
      res.json({ configured: true });
    }));
    app.post('/api/converty/authorize', admin, this.handle(async (_req, res) => {
      const credentials = await this.credentials(); const state = randomUUID(); const nonce = randomBytes(32).toString('hex');
      await this.put(`oauth:${state}`, { nonce: this.hash(nonce), until: this.now() + 600000, clientId: credentials.clientId });
      res.cookie('arima_converty_oauth', nonce, { httpOnly: true, secure: this.origin.startsWith('https:'), sameSite: 'lax', path: '/api/converty/callback', maxAge: 600000 });
      const url = new URL(`${PARTNER}/oauth2/authorize`);
      url.search = new URLSearchParams({ response_type: 'code', client_id: credentials.clientId, redirect_uri: `${this.origin}/api/converty/callback`, scope: CONVERTY_SCOPES.join(' '), state }).toString();
      res.json({ url: url.href });
    }));
    app.post('/api/converty/disconnect', admin, this.handle(async (_req, res) => {
      await this.remove('tokens'); await this.remove('profile'); this.catalogCache = undefined; res.json({ connected: false });
    }));
    app.post('/api/converty/reconcile', admin, this.handle(async (req, res) => {
      const key = this.jobKey(req.body.attemptKey); const job = await this.get(key);
      if (!job || !['sending', 'uncertain'].includes(job.status) || job.startedAt > this.now() - 120000) issue(409, 'RECONCILE_STATE', 'Cette soumission ne peut pas encore être rapprochée.');
      if (req.body.confirmed === false) await this.put(key, { ...job, status: 'rejected' });
      else {
        if (!Number.isInteger(req.body.reference) || req.body.reference < 1) issue(400, 'ORDER_REFERENCE', 'Indiquez la référence vérifiée dans Converty.');
        const receipt: ShopReceipt = { reference: req.body.reference, webReference: job.attemptKey, currency: 'TND', subtotal: job.quote.subtotal, delivery: job.quote.delivery, total: job.quote.total, items: job.quote.items, receivedAt: new Date(this.now()).toISOString() };
        await this.put(key, { ...job, status: 'confirmed', receipt });
      }
      res.json({ reconciled: true });
    }));
  }
}
