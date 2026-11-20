import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store, checkPassword, hashPassword, tokenHash } from './database';
import type { PostgresStore } from './postgres';
import type { Product, Cafe, Invoice, InvoiceItem, Order, OrderStatus } from '../src/types';
class ApiError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new ApiError(status, message); };
const id = (prefix: string) => `${prefix}_${randomUUID()}`;
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const sumItems = (items: InvoiceItem[]) => {
    const total = items.reduce((sum, item) => sum + Math.round(item.price * item.quantity * 1000), 0);
    if (!Number.isSafeInteger(total) || total > 1000000000000)
        fail(400, 'Montant total trop élevé.');
    return total / 1000;
};
const statuses: OrderStatus[] = ['En attente', 'En préparation', 'Prête', 'Livrée', 'Annulée'];
const text = (value: unknown, label: string, max = 200, optional = false) => {
    if (optional && (value === undefined || value === ''))
        return '';
    if (typeof value !== 'string' || !value.trim() || value.length > max)
        return fail(400, `${label} invalide.`);
    return value.trim();
};
const number = (value: unknown, label: string, min = 0, max = 1000000) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        return fail(400, `${label} invalide.`);
    return value;
};
const password = (value: unknown) => {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128)
        return fail(400, 'Le mot de passe doit contenir entre 8 et 128 caractères.');
    return value;
};
const username = (value: unknown) => {
    const name = text(value, 'Identifiant', 80).toLowerCase();
    if (!/^[a-z0-9_.-]{3,80}$/.test(name))
        fail(400, "L'identifiant doit contenir 3 à 80 lettres, chiffres, points, tirets ou underscores.");
    return name;
};
const date = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
        return fail(400, 'Date invalide.');
    return value;
};
const cookieToken = (req: Request) => {
    const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('arima_session='));
    const value = cookie?.slice('arima_session='.length);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
};
interface User {
    id: string;
    name: string;
    role: 'admin' | 'cafe';
    username: string;
}
export interface AppOptions {
    sessionHours?: number;
    secureCookie?: boolean;
}
export function createApp(store: Store | PostgresStore, options: AppOptions = {}) {
    const app = express();
    app.disable('x-powered-by');
    if (store instanceof Store) {
        // A local SQLite connection has one transaction context. Queue requests
        // so async handlers cannot join or commit another request's transaction.
        let tail = Promise.resolve();
        app.use('/api', (_req, res, next) => {
            const previous = tail;
            let release: () => void;
            tail = new Promise<void>(resolve => { release = resolve; });
            void previous.then(() => {
                if (res.destroyed) { release(); return; }
                res.once('finish', release); res.once('close', release); next();
            });
        });
    }
    const sessionHours = options.sessionHours ?? 24;
    if (!Number.isFinite(sessionHours) || sessionHours <= 0 || sessionHours > 720)
        throw new Error('SESSION_HOURS must be between 0 and 720.');
    const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: !!options.secureCookie, path: '/' };
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        next();
    });
    app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    app.use('/api', (req, _res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
            try {
                if (new URL(req.headers.origin).host !== req.headers.host)
                    return next(new ApiError(403, 'Origine de la requête non autorisée.'));
            }
            catch {
                return next(new ApiError(403, 'Origine invalide.'));
            }
        }
        next();
    });
    app.use(express.json({ limit: '5mb' }));
    app.use('/api', (req, _res, next) => {
        if (req.body !== undefined && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object'))
            return next(new ApiError(400, 'Un objet JSON est requis.'));
        req.body ??= {};
        next();
    });
    const route = (fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
        try {
            Promise.resolve(fn(req, res, next)).catch(next);
        }
        catch (error) {
            next(error);
        }
    };
    const user = (res: Response): User => res.locals.user;
    const admin = (_req: Request, res: Response, next: NextFunction) => user(res).role === 'admin' ? next() : next(new ApiError(403, 'Accès réservé aux administrateurs.'));
    const mustGet = async <K extends 'products' | 'cafes' | 'invoices' | 'orders' | 'notifications'>(table: K, recordId: string) => await store.get(table, recordId) ?? fail(404, 'Enregistrement introuvable.');
    const owns = (res: Response, cafeId?: string) => { if (user(res).role === 'cafe' && user(res).id !== cafeId)
        fail(403, 'Accès non autorisé à cet établissement.'); };
    const notify = async (recipientId: string, title: string, message: string) => await store.save('notifications', { id: id('notif'), title, message, date: today(), read: false, recipientId });
    app.get('/api/health', route(async (_req, res) => {
        await store.db.prepare('SELECT 1').get();
        res.json({ status: 'ok', database: store instanceof Store ? 'sqlite' : 'postgres' });
    }));
    const attempts = new Map<string, {
        count: number;
        until: number;
    }>();
    app.post('/api/auth/login', route(async (req, res) => {
        const now = Date.now();
        for (const [key, entry] of attempts)
            if (entry.until <= now)
                attempts.delete(key);
        const key = req.ip || 'local';
        const limit = attempts.get(key);
        if (limit && limit.count >= 10) {
            res.setHeader('Retry-After', String(Math.ceil((limit.until - now) / 1000)));
            fail(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
        }
        const name = text(req.body.username, 'Identifiant', 80).toLowerCase();
        const portal = req.body.portal;
        if (portal !== undefined && portal !== 'admin' && portal !== 'cafe')
            fail(400, 'Espace de connexion invalide.');
        const supplied = req.body.password;
        if (typeof supplied !== 'string' || !supplied || supplied.length > 128)
            fail(400, 'Mot de passe invalide.');
        const account = await store.account(name);
        // The same expensive password check is used for unknown users.
        const fallbackHash = (await store.account('admin'))?.password_hash || (await store.db.prepare("SELECT password_hash FROM accounts WHERE role='admin' LIMIT 1").get())?.password_hash as string;
        const valid = checkPassword(supplied, account?.password_hash || fallbackHash);
        // The chosen login tab only changes the presentation. Permissions always
        // come from the authenticated account, including when the other tab is open.
        if (!account || !valid) {
            attempts.set(key, { count: (limit?.count || 0) + 1, until: limit?.until || now + 15 * 60000 });
            fail(401, 'Identifiant ou mot de passe incorrect.');
        }
        const cafe = account.role === 'cafe' ? await mustGet('cafes', account.id) : undefined;
        const token = randomBytes(32).toString('hex');
        await store.transaction(async () => {
            await store.db.prepare('DELETE FROM sessions WHERE expires_at<=? OR token_hash=?').run(now, tokenHash(cookieToken(req) || ''));
            await store.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token), account.id, now + sessionHours * 3600000);
        });
        attempts.delete(key);
        res.cookie('arima_session', token, { ...cookieOptions, maxAge: sessionHours * 3600000 });
        res.json({ success: true, user: { id: account.id, name: cafe?.name || 'Administrateur Arima', role: account.role, username: account.username } });
    }));
    app.post('/api/auth/logout', route(async (req, res) => {
        const token = cookieToken(req);
        if (token)
            await store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
        res.clearCookie('arima_session', cookieOptions);
        res.json({ success: true });
    }));
    app.use('/api', route(async (req, res, next) => {
        const token = cookieToken(req);
        if (!token)
            fail(401, 'Veuillez vous connecter.');
        const account = await store.db.prepare(`SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id
      WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash(token), Date.now()) as any;
        if (!account)
            fail(401, 'Session expirée. Veuillez vous reconnecter.');
        const cafe = account.role === 'cafe' ? await mustGet('cafes', account.id) : undefined;
        res.locals.user = { id: account.id, name: cafe?.name || 'Administrateur Arima', role: account.role, username: account.username };
        next();
    }));
    app.get('/api/auth/me', route(async (_req, res) => { res.json({ valid: true, user: user(res) }); }));
    const productData = (body: any): Omit<Product, 'id'> => ({
        name: text(body.name, 'Nom du produit'), price: money(number(body.price, 'Prix')),
        category: text(body.category, 'Catégorie', 100),
        image: text(body.image, 'Image', 2000000, true), description: text(body.description, 'Description', 4000, true),
    });
    app.get('/api/products', route(async (_req, res) => {
        const cafe = user(res).role === 'cafe' ? await mustGet('cafes', user(res).id) : undefined;
        res.json((await store.list('products')).map(product => cafe
            ? { ...product, price: cafe.prices[product.id] ?? product.price }
            : product));
    }));
    app.post('/api/products', admin, route(async (req, res) => {
        res.status(201).json(await store.save('products', { id: id('product'), ...productData(req.body) }));
    }));
    app.put('/api/products/:id', admin, route(async (req, res) => {
        const old = await mustGet('products', req.params.id);
        res.json(await store.save('products', { id: old.id, ...productData({ ...old, ...req.body }) }));
    }));
    app.delete('/api/products/:id', admin, route(async (req, res) => {
        await mustGet('products', req.params.id);
        await store.transaction(async () => {
            await store.remove('products', req.params.id);
            for (const cafe of await store.list('cafes')) {
                delete cafe.prices[req.params.id];
                await store.save('cafes', cafe);
            }
        });
        res.json({ success: true });
    }));
    const prices = async (value: unknown) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return fail(400, 'Tarifs invalides.');
        return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([productId, price]) => {
            await mustGet('products', productId);
            return [productId, money(number(price, 'Tarif'))];
        })));
    };
    app.get('/api/cafes', route(async (_req, res) => {
        res.json((await store.list('cafes')).filter(c => user(res).role === 'admin' || c.id === user(res).id));
    }));
    app.post('/api/cafes', admin, route(async (req, res) => {
        const cafe: Cafe = { id: id('cafe'), name: text(req.body.name, 'Nom du café'), prices: await prices(req.body.prices || {}), username: username(req.body.username) };
        const secret = password(req.body.password);
        if (await store.account(cafe.username!))
            fail(409, 'Cet identifiant est déjà utilisé.');
        await store.transaction(async () => { await store.createAccount(cafe.id, cafe.username!, secret, 'cafe'); await store.save('cafes', cafe); });
        res.status(201).json(cafe);
    }));
    app.put('/api/cafes/:id', admin, route(async (req, res) => {
        const old = await mustGet('cafes', req.params.id);
        const cafe = { ...old, name: text(req.body.name ?? old.name, 'Nom du café'), prices: req.body.prices === undefined ? old.prices : await prices(req.body.prices), username: username(req.body.username || old.username) };
        const secret = req.body.password ? password(req.body.password) : undefined;
        const existing = await store.account(cafe.username!);
        if (existing && existing.id !== old.id)
            fail(409, 'Cet identifiant est déjà utilisé.');
        await store.transaction(async () => {
            if (await store.db.prepare('SELECT id FROM accounts WHERE id=?').get(old.id)) {
                await store.db.prepare('UPDATE accounts SET username=? WHERE id=?').run(cafe.username!, old.id);
                if (secret)
                    await store.db.prepare('UPDATE accounts SET password_hash=? WHERE id=?').run(hashPassword(secret), old.id);
            }
            else if (secret)
                await store.createAccount(old.id, cafe.username!, secret, 'cafe');
            else
                fail(400, 'Veuillez définir un mot de passe pour cet établissement.');
            if (secret || cafe.username !== old.username)
                await store.db.prepare('DELETE FROM sessions WHERE account_id=?').run(old.id);
            await store.save('cafes', cafe);
        });
        res.json(cafe);
    }));
    app.delete('/api/cafes/:id', admin, route(async (req, res) => {
        await mustGet('cafes', req.params.id);
        await store.transaction(async () => {
            await store.db.prepare('DELETE FROM accounts WHERE id=?').run(req.params.id);
            await store.remove('cafes', req.params.id);
        });
        res.json({ success: true });
    }));
    const resolveItems = async (value: unknown, cafe?: Cafe, historical: InvoiceItem[] = []): Promise<InvoiceItem[]> => {
        if (!Array.isArray(value) || value.length === 0 || value.length > 200)
            return fail(400, 'Choisissez entre 1 et 200 produits.');
        const seen = new Set<string>();
        return Promise.all(value.map(async (item) => {
            if (!item || typeof item !== 'object')
                return fail(400, 'Ligne de produit invalide.');
            const productId = text(item.productId, 'Produit', 100);
            if (seen.has(productId))
                fail(400, 'Un produit ne peut apparaître que dans une seule ligne.');
            seen.add(productId);
            const product = await store.get('products', productId);
            const archived = historical.find(it => it.productId === productId);
            if (!product && !archived)
                fail(400, 'Un produit sélectionné est introuvable.');
            const soldByWeight = /kg|baklawa|kaak|samsa/i.test(product?.name || archived!.name);
            const quantity = number(item.quantity, 'Quantité', soldByWeight ? 0.001 : 1, 100000);
            if (!soldByWeight && !Number.isInteger(quantity))
                fail(400, 'La quantité doit être un nombre entier pour un produit vendu à la pièce.');
            if (soldByWeight && Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001)
                fail(400, 'La quantité en kg accepte au maximum trois décimales.');
            return { productId, name: product?.name || archived!.name, price: product ? (cafe?.prices[productId] ?? product.price) : archived!.price, quantity };
        }));
    };
    const invoiceData = async (body: any, old?: Invoice) => {
        const value = { ...old, ...body };
        const cafe = value.cafeId ? await mustGet('cafes', text(value.cafeId, 'Café', 100)) : undefined;
        const items = body.items === undefined && old ? old.items : await resolveItems(value.items, cafe, old?.items);
        if (!['paid', 'unpaid', 'draft'].includes(value.status || 'unpaid'))
            fail(400, 'Statut de facture invalide.');
        if (value.taxEnabled !== undefined && typeof value.taxEnabled !== 'boolean')
            fail(400, 'Option de taxe invalide.');
        const taxEnabled = value.taxEnabled ?? true;
        const taxRate = number(value.taxRate ?? 19, 'Taux de taxe', 0, 100);
        const subtotal = sumItems(items);
        const taxAmount = taxEnabled ? money(subtotal * taxRate / 100) : 0;
        return {
            date: date(value.date || today()), customerName: text(value.customerName, 'Nom du client'),
            customerPhone: text(value.customerPhone, 'Téléphone', 100, true), customerAddress: text(value.customerAddress, 'Adresse', 1000, true),
            items, subtotal, taxEnabled, taxRate, taxAmount, total: money(subtotal + taxAmount), status: value.status || 'unpaid',
            cafeId: cafe?.id, cafeName: cafe?.name,
        };
    };
    app.get('/api/invoices', route(async (_req, res) => { res.json((await store.list('invoices')).filter(i => user(res).role === 'admin' || i.cafeId === user(res).id)); }));
    app.get('/api/invoices/:id', route(async (req, res) => { const invoice = await mustGet('invoices', req.params.id); owns(res, invoice.cafeId); res.json(invoice); }));
    app.post('/api/invoices', admin, route(async (req, res) => {
        const data = await invoiceData(req.body);
        const invoice = await store.transaction(async () => await store.save('invoices', { id: id('inv'), invoiceNumber: await store.nextNumber('invoices'), ...data }));
        res.status(201).json(invoice);
    }));
    app.put('/api/invoices/:id', admin, route(async (req, res) => {
        const old = await mustGet('invoices', req.params.id);
        // A payment change preserves the original unit prices and archived customer data.
        if (Object.keys(req.body).every(k => k === 'status')) {
            if (!['paid', 'unpaid', 'draft'].includes(req.body.status))
                fail(400, 'Statut de facture invalide.');
            res.json(await store.save('invoices', { ...old, status: req.body.status }));
        }
        else
            res.json(await store.save('invoices', { ...old, ...await invoiceData(req.body, old) }));
    }));
    app.delete('/api/invoices/:id', admin, route(async (req, res) => {
        await mustGet('invoices', req.params.id);
        if ((await store.list('orders')).some(o => o.convertedToInvoiceId === req.params.id))
            fail(409, "Cette facture est liée à une commande et doit rester archivée.");
        await store.remove('invoices', req.params.id);
        res.json({ success: true });
    }));
    app.get('/api/orders', route(async (_req, res) => { res.json((await store.list('orders')).filter(o => user(res).role === 'admin' || o.cafeId === user(res).id)); }));
    app.get('/api/orders/:id', route(async (req, res) => { const order = await mustGet('orders', req.params.id); owns(res, order.cafeId); res.json(order); }));
    app.post('/api/orders', route(async (req, res) => {
        const cafeId = user(res).role === 'cafe' ? user(res).id : text(req.body.cafeId, 'Café', 100);
        if (user(res).role === 'cafe' && req.body.cafeId && req.body.cafeId !== cafeId)
            fail(403, 'Vous ne pouvez commander que pour votre établissement.');
        const cafe = await mustGet('cafes', cafeId);
        const items = await resolveItems(req.body.items, cafe);
        const order = await store.transaction(async () => {
            const record: Order = {
                id: id('order'), orderNumber: await store.nextNumber('orders'), date: today(), cafeId, cafeName: cafe.name, items,
                totalQuantity: money(items.reduce((sum, it) => sum + it.quantity, 0)), estimatedValue: sumItems(items), status: 'En attente',
            };
            await store.save('orders', record);
            await notify(user(res).role === 'admin' ? cafeId : 'admin', 'Nouvelle commande', `${record.orderNumber} — ${cafe.name} — ${record.estimatedValue.toFixed(3)} DT`);
            return record;
        });
        res.status(201).json(order);
    }));
    app.put('/api/orders/:id', route(async (req, res) => {
        const old = await mustGet('orders', req.params.id);
        owns(res, old.cafeId);
        if (old.convertedToInvoiceId)
            fail(409, 'Cette commande a déjà été facturée.');
        if (user(res).role === 'cafe' && old.status !== 'En attente')
            fail(409, 'Seules les commandes en attente peuvent être modifiées.');
        const status = req.body.status ?? old.status;
        if (!statuses.includes(status))
            fail(400, 'Statut de commande invalide.');
        if (user(res).role === 'cafe' && status !== old.status && status !== 'Annulée')
            fail(403, 'Vous pouvez uniquement annuler votre commande en attente.');
        const items = req.body.items === undefined ? old.items : await resolveItems(req.body.items, await mustGet('cafes', old.cafeId));
        const order = { ...old, status, items, totalQuantity: money(items.reduce((sum, it) => sum + it.quantity, 0)), estimatedValue: sumItems(items) };
        await store.transaction(async () => {
            await store.save('orders', order);
            await notify(user(res).role === 'admin' ? old.cafeId : 'admin', 'Commande mise à jour', `${old.orderNumber} : ${status}`);
        });
        res.json(order);
    }));
    app.delete('/api/orders/:id', admin, route(async (req, res) => {
        const order = await mustGet('orders', req.params.id);
        if (order.convertedToInvoiceId)
            fail(409, 'Une commande facturée doit rester archivée.');
        await store.remove('orders', order.id);
        res.json({ success: true });
    }));
    app.post('/api/orders/:id/convert', admin, route(async (req, res) => {
        const result = await store.transaction(async () => {
            if (!(store instanceof Store)) await store.db.prepare('SELECT id FROM orders WHERE id=? FOR UPDATE').get(req.params.id);
            const order = await mustGet('orders', req.params.id);
            if (order.convertedToInvoiceId)
                fail(409, 'Cette commande a déjà été convertie en facture.');
            if (order.status === 'Annulée')
                fail(409, 'Une commande annulée ne peut pas être facturée.');
            const previous = (await store.list('invoices')).filter(i => i.cafeId === order.cafeId).at(-1);
            const invoice: Invoice = {
                id: id('inv'), invoiceNumber: await store.nextNumber('invoices'), date: today(), customerName: order.cafeName,
                customerPhone: previous?.customerPhone || '', customerAddress: previous?.customerAddress || '',
                items: order.items, subtotal: order.estimatedValue, taxEnabled: false, taxRate: 0, taxAmount: 0, total: order.estimatedValue,
                status: 'unpaid', cafeId: order.cafeId, cafeName: order.cafeName,
            };
            await store.save('invoices', invoice);
            const updated = { ...order, status: 'Livrée' as const, convertedToInvoiceId: invoice.id, convertedToInvoiceNumber: invoice.invoiceNumber };
            await store.save('orders', updated);
            await notify(order.cafeId, 'Facture générée', `${invoice.invoiceNumber} — ${invoice.total.toFixed(3)} DT`);
            return { success: true, invoice, order: updated };
        });
        res.status(201).json(result);
    }));
    app.get('/api/notifications', route(async (_req, res) => { res.json((await store.list('notifications')).filter(n => n.recipientId === user(res).id)); }));
    app.post('/api/notifications/:id/read', route(async (req, res) => {
        const notification = await mustGet('notifications', req.params.id);
        if (notification.recipientId !== user(res).id)
            fail(403, 'Cette notification ne vous appartient pas.');
        await store.save('notifications', { ...notification, read: true });
        res.json({ success: true });
    }));
    app.get('/api/dashboard', route(async (req, res) => {
        const scope = user(res).role === 'cafe' ? user(res).id : req.query.cafeId;
        const invoices = (await store.list('invoices')).filter(i => !scope || scope === 'all' || i.cafeId === scope);
        const issued = invoices.filter(i => i.status !== 'draft');
        const sales = new Map<string, {
            id: string;
            name: string;
            quantity: number;
            revenue: number;
        }>();
        const categories = new Map<string, number>();
        for (const invoice of issued)
            for (const item of invoice.items) {
                const value = money(item.quantity * item.price);
                const current = sales.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, revenue: 0 };
                current.quantity += item.quantity;
                current.revenue = money(current.revenue + value);
                sales.set(item.productId, current);
                const category = (await store.get('products', item.productId))?.category || 'Autre';
                categories.set(category, money((categories.get(category) || 0) + value));
            }
        res.json({
            totalSales: money(issued.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)),
            totalOrders: invoices.length,
            revenueUnpaid: money(issued.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + i.total, 0)),
            bestSellers: [...sales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
            categorySales: [...categories].map(([name, value]) => ({ name, value })),
            recentInvoices: invoices.slice(-5).reverse(),
        });
    }));
    app.use('/api', (_req, res) => { res.status(404).json({ error: 'Route API introuvable.' }); });
    app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
        if (error instanceof ApiError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        if (error.type === 'entity.parse.failed') {
            res.status(400).json({ error: 'JSON invalide.' });
            return;
        }
        if (error.type === 'entity.too.large') {
            res.status(413).json({ error: 'Requête trop volumineuse.' });
            return;
        }
        if (error.code === '23505' || error.code?.startsWith('SQLITE_CONSTRAINT') || error.message?.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Un enregistrement avec cet identifiant existe déjà.' });
            return;
        }
        console.error(error);
        res.status(500).json({ error: 'Erreur interne du serveur. Les données n’ont pas été enregistrées.' });
    });
    return app;
}
