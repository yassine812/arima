# ARIMA public shop + Converty

The public storefront is `/` (also `/boutique`). The existing administrator and café portal is `/espace`; legacy `/?espace=cafe` remains supported. Public retail prices never use the private café tariff database.

## Activation

1. Set `CONVERTY_ENCRYPTION_KEY` on the production server to 32 cryptographically random bytes, base64 encoded. Keep this key stable; changing it makes previously encrypted credentials unreadable. Keep it out of source control and browser bundles.
2. Create a **private** Converty application for the existing ARIMA store. Register `https://arima-eight.vercel.app/api/converty/callback` exactly and grant only `read-stores`, `read-products`, `create-orders`.
3. In `/espace`, sign in as administrator, open **Boutique en ligne**, enter its client ID and secret, then use **Autoriser dans Converty**. Confirm the official OAuth permission screen for ARIMA. Secrets and tokens are encrypted with AES-256-GCM in server metadata. They are never returned to public callers.
4. Verify the live collection, variants, stock, checkout fields and shipping before accepting customer orders. Until connected, the existing illustrated page and Converty links remain usable. No demo orders are sent to production.

Defaults bind the connection to ARIMA store `69e9d7c9fef2de95043ee3ba`, slug `arima`, Tunisia, TND. `PUBLIC_SITE_ORIGIN` may override the canonical production origin (no trailing slash) for another deployment or local development; register the matching callback in Converty. Do not point previews to production credentials. OAuth state is single-use, ten-minute, nonce-cookie bound. Tokens refresh server-side with a distributed lease and a per-instance shared refresh promise.

## Orders and recovery

Public endpoints expose only an allowlisted product DTO. Quotes re-read each selected product directly from Converty; order confirmation re-reads again, checks availability and variants, recalculates with integer millimes, and requires a second confirmation when the amount changes. Current flat product delivery charges and quantity offers are supported. Bundle quantities are offer counts in the public cart and expand to physical units with the verified whole-tier price on the server. Stock checks combine all offers for the same product. Conflicting shipping rules, unsupported required checkout fields, legacy variants, combined variant/bundle products, indivisible millime tier prices and active coupon configurations use the native Converty flow rather than guessing.

Each attempt has a durable encrypted claim committed **before** Converty's non-idempotent order creation call. Concurrent submits return the existing result. If the vendor times out or persistence fails after acceptance, the order remains **uncertain** and is never automatically re-posted. The customer can check the same reference without reordering. The administrator can search `ARIMA web · <reference>` in Converty order notes, then reconcile it in **Boutique en ligne** after two minutes. Confirm receipt only with the verified Converty order number; confirm absence only after checking Converty. No read-orders permission is requested.

Successful orders are pending, payable on delivery, and show a printable branded acknowledgement, not a fiscal invoice. Customer coordinates go directly to Converty; our pending receipt storage contains product/amount snapshots and references, not customer coordinates. Browser storage contains cart selections and pending reference only. API responses are no-store, mutations enforce the canonical Origin and an HttpOnly shopper cookie, and encrypted HMAC-IP counters rate-limit public endpoints.

The official product list may be cached by Converty for up to twelve hours. Our additional catalog cache is sixty seconds; single-product checks at quote/submit are essential. Fields or delivery rules added in Converty must be reviewed here too. Local disconnect removes server tokens; revoke the application from Converty to revoke upstream authorization.

## Validation

`npm run lint`, `npm run build`, `npm test`. The Converty suite uses an injected mock of the documented official hosts; it exercises OAuth, wrong-store rejection, secret encryption, server pricing, discounts, stock, variants, stale quotes, concurrent submits, uncertain recovery, token refresh and actual PostgreSQL SQL through PGlite. It does not submit a real customer order. Browser previews use a separate temporary database and mock transport, never production credentials.

Reference: [Converty OAuth API documentation](https://cdn.converty.shop/oauth_docs/v1/index.html), [official OpenAPI schema](https://cdn.converty.shop/oauth_docs/v1/openapi.json).
