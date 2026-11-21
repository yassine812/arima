# ARIMA — invoices, products and café orders

React and Tailwind frontend, Express API, and a persistent SQLite database. Requires Node.js 24 or later. SQLite uses Node's built-in `node:sqlite` module; Node 24 currently prints an experimental-feature notice.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set `ADMIN_PASSWORD` before the first launch.
3. Run `npm run dev` and open http://localhost:3000.

This checkout already has a local configuration and a migrated database. Use the existing administrator credentials. The initial administrator settings only apply when creating a new database; changing the environment does not reset an existing account.

No Gemini key or external database service is required.

## Data and migration

The database is `data/arima.sqlite` by default. On its first startup, a new database imports all products, cafés, invoices, orders and notifications from `data-arima-db.json` in one transaction. Café passwords are hashed with a random salt using scrypt. The original JSON stays unchanged as a legacy backup and is no longer used for live storage.

Migration runs once. Reading records never recreates deleted products or replaces invoices with sample data. Existing invoice numbers and historical prices are preserved. New invoice/order numbers use the current year and a transactional sequence that does not reuse deleted numbers.

SQLite uses WAL mode. For backups, stop the server before copying the database, or use a SQLite-aware backup tool. Do not copy only the main database file while writes are in progress; recent changes can be in the `-wal` file. The original server and JSON were also preserved in `backups/` during the upgrade. These legacy backups contain the original plaintext café passwords; keep them private.

## Login and permissions

The API sets a random, HttpOnly, SameSite=Strict session cookie. Session hashes and expiry timestamps are stored in SQLite, so sessions survive a server restart and logout revokes them. Passwords and session credentials are never returned in café listings or stored in frontend localStorage. Failed login attempts are limited per client IP. Requests from a different browser origin cannot mutate data.

Administrators manage products, cafés, pricing, invoices, orders and delivery status. Café accounts can read their own invoices, dashboard, orders and notifications, place orders, and edit/cancel their own pending orders. Café credentials are configured in the café management screen; passwords must have at least eight characters. Leaving the password empty while editing keeps the existing password. Replacing credentials revokes that café's sessions.

### Café partner portal

Use the single login form at `/` with your account's username and password. Existing `/?espace=cafe` links still work. Valid credentials automatically open the account's own space; there is no role selector. An administrator creates café accounts in **Cafés partenaires → Ajouter un Café**, or edits the credentials of an existing café. There is no public registration. Permissions always come from the account's server-assigned role.

Cafés land on **Les produits**, with search, category filters and their own partner prices. **Commander** selects a product in a new order; the café can adjust quantities, submit and follow the order in **Mes commandes**. **Catalogues** includes both saved editions, the page-turning reader and PDF download/print controls. **Mes factures** and **Mon activité** show only that café's records. Product management, ticket creation, other cafés' prices and administration controls are unavailable to café accounts. The server enforces ownership and calculates all order prices and totals.

The default server listens only on this computer. Remote cafés need a hosted HTTPS deployment and individual credentials; a `localhost` link cannot be used from their devices.

Prices, totals, invoice numbers and order numbers are calculated by the server. Quantities must be positive whole numbers for products sold per piece. Products identified by the existing UI as kg/baklawa/kaak/samsa accept fractional quantities with up to three decimals. Café price overrides, including zero, take priority over catalogue prices. Amounts are rounded to three decimal places. Payment-only updates retain original invoice line prices even after catalogue changes. An order can be converted to an invoice once; the invoice, order link and notification are committed together. Invoiced orders and their linked invoices cannot be deleted through the API. Removing a café or product keeps historical invoice/order snapshots.

## API

All `/api` endpoints require a valid session except health, login and logout. Errors return `{ "error": "message" }` with a suitable HTTP status.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Database health |
| `POST /api/auth/login` | `{ username, password }`; sets cookie |
| `GET /api/auth/me` | Current account |
| `POST /api/auth/logout` | Revokes session and clears cookie |
| `GET/POST /api/products` | Catalogue / administrator creation |
| `PUT/DELETE /api/products/:id` | Administrator catalogue changes |
| `GET/POST /api/cafes` | Scoped café list / administrator creation |
| `PUT/DELETE /api/cafes/:id` | Administrator café/pricing/account changes |
| `GET/POST /api/invoices` | Scoped invoices / administrator creation |
| `GET/PUT/DELETE /api/invoices/:id` | Scoped read / administrator changes |
| `GET/POST /api/orders` | Scoped orders / create order |
| `GET/PUT/DELETE /api/orders/:id` | Scoped read/edit; administrator deletion |
| `POST /api/orders/:id/convert` | Administrator conversion to invoice |
| `GET /api/dashboard?cafeId=...` | Scoped totals; cafés cannot override their scope |
| `GET /api/notifications` | Current account's notifications |
| `POST /api/notifications/:id/read` | Mark an owned notification as read |

## Verification and build

- `npm test`: API integration tests using temporary databases, including persistence, migration, permissions, session revocation, pricing, validation and order conversion.
- `npm run lint`: TypeScript checks.
- `npm run build`: Build frontend and bundled server into `dist/`.
- To run the build in PowerShell: `$env:NODE_ENV='production'; npm start`.

The server binds to `127.0.0.1` by default. For an HTTPS deployment, set `NODE_ENV=production`, `COOKIE_SECURE=true`, a suitable `HOST` and `PORT`, and `DATABASE_PATH` on persistent writable storage. Use the same public origin for UI and API. The current login limiter is in memory and assumes a single server instance. This setup is running locally; it has not been deployed to a public host.


## Mini tiramisus

The mini range contains all ten existing tiramisu flavours at the confirmed price of 2.000 DT each, in the `Mini tiramisus` category. These are ordinary database products available in catalogue, orders, invoice creation and café pricing. `npm run catalog:add-minis` adds any missing mini variants without changing existing products or prices, and creates a SQLite backup before insertion. This command was already run for the current checkout. Each mini variant has its own generated illustration in the correct mini-cup format; regular-size imagery is never substituted. The original supplied photos remain in public/products as source references. The catalogue now uses the generated illustrations in public/products/illustrated.

Illustration audit: all 29 products now have separate generated illustrations, with reviewed flavour toppings, flavour-specific backgrounds and the appropriate container format. Regular Kinder Bueno uses the standard wide rectangular tiramisu tray, with the mini recipe’s cream/chocolate layers and chocolate topping. See output/product-photo-audit.json for the full mapping and output/illustration-prompts.json for every generation prompt and source artifact. Cards use continuous CSS movement while visible. This is animated UI presentation of generated raster illustrations, not video files.


### Illustrated atelier interface

The entire application uses the ARIMA vanilla, strawberry and pistachio design system in `src/atelier.css`, with Fraunces headings, original SVG atelier artwork and the existing generated product illustrations. Dashboard, catalogue, invoices, orders, café management and sign-in share the same visual language. Invoice quick-add and order selection include product thumbnails.

At the owner’s explicit request, motion is always enabled in ARIMA, including when the browser requests reduced motion. There is no animation toggle. Artwork floats continuously; cursor movement tilts cards, shifts illustrations, highlights surfaces and moves the tiramisu cursor. Button magnets and product-image parallax use a single requestAnimationFrame loop while the pointer moves. Touch input keeps normal taps and scrolling. Offscreen artwork and hidden tabs pause unnecessary work. Printed invoices retain their paper layout. Design details are recorded in `output/atelier-design-spec.md`.


### Painted product background motion

All 29 catalogue illustrations now use an isolated transparent dessert foreground above six independently moving, painterly ingredient backgrounds. The ingredient artwork matches the product illustrations and moves slowly in place over 22–32 second cycles; it does not orbit. The foreground stays steady. Existing product data, images, flavours and prices are preserved. Generated PNG originals and optimized WebP assets are in `public/products/layers`; the ingredient atlas is in `public/brand/motion`. Generation briefs and source mappings are recorded in `output/painted-product-layers.json`.

The cursor is a small tiramisu. Clicking emits eight decorative tiramisu/cheesecake particles that expire after 1.5 seconds, with a 40-particle cap and no interception of form controls. Ambient effects pause offscreen or when the tab is hidden.

### Versioned PDF catalogue

The Catalogue menu lists saved editions with their original save date (displayed in Tunis time). Version 1 is the supplied seven-page ARIMA PDF. Opening an edition launches a modal book reader with page turns, keyboard navigation, thumbnails, download and A4 printing. It switches to a single page on narrow screens. Closing the modal releases the iframe and its animation loop.

`src/catalogueVersions.json` records each edition, timestamp and SHA-256. Each snapshot lives in `public/catalogue/versions/vN/`; the PDF is byte-identical to the supplied original. To prepare another edition, install PyMuPDF and Pillow, then run `python scripts/prepare-catalogue.py "C:\path\catalogue.pdf"` and rebuild. A different PDF creates the next version; preparing the same PDF preserves its archived edition and save date.

### Saved PDF catalogue editions

The Catalogue menu lists preserved editions, starting with Version 1. Clicking a cover opens a frameless modal book reader, with keyboard/touch page turns, floating navigation, printing and the original PDF download. The closed cover is centred on its own; interior spreads use both pages. There is no header, footer, thumbnail strip or paper-coloured frame around the book. Save timestamps are stored in `src/catalogueVersions.json` and shown in Tunisia time. Archived PDF bytes and page assets live in `public/catalogue/versions/vN/`.

To save a new PDF edition, install Python's PyMuPDF and Pillow if needed, then run `python scripts/prepare-catalogue.py "C:/path/to/catalogue.pdf"` and rebuild the app. A different PDF gets the next version number. Repeating the same PDF preserves its existing version and save date. Keep the registry and version folders together when backing up or deploying.

### Photographic catalogue, Version 2

`output/pdf/ARIMA_Catalogue_V2.pdf` is the 14-page A4 photographic edition. It includes all 29 current products, including the 10 mini tiramisus and cheesecake Raffaello absent from V1. It shares the site's Fraunces and Plus Jakarta Sans typography, vanilla paper, strawberry and pistachio palette, rounded panels, stars and price stickers. It uses 23 existing ARIMA photo assets and six photorealistic assets generated from the user's references. Regular and mini Kinder Bueno use matching cream/chocolate layers and a Bueno wafer topping. The website's animated product artwork is unchanged. Sources, prompts, font licences and coverage checks are saved under `output/catalogue-v2/`.

All 18 products already present in V1 retain its exact catalogue price. Added products use their confirmed current price: minis at 2.000 DT and cheesecake Raffaello at 4.000 DT. `python scripts/build-catalogue-v2.py --prices v1` rebuilds the PDF and review images; `python scripts/validate-catalogue-v2.py` checks product coverage, V1 tariffs, added product prices and rendered text. After reviewing the PDF, `python scripts/prepare-catalogue.py output/pdf/ARIMA_Catalogue_V2.pdf --labels output/catalogue-v2/page-labels.json --replace-version 2` revises Version 2, keeping its earlier assets in place and storing a new revision folder. The original V1 cannot be revised with this flag.

### Regenerated ARIMA brand logo

The new transparent brand lockup is `public/brand/arima-logo-v2.png`; its matching cake-only mark is `public/brand/arima-mark-v2.png`. Built-in image generation preserved the dessert-and-cream identity and added the site's rose and pistachio accents. References and prompts are recorded in `output/brand-identity/`. The original JPEG is retained.

`BrandLogo` shares the new assets across navigation, loading, sign-in and invoice views. `src/brand-identity.css` adds a small continuous float, decorative glints and a hover greeting, pauses when the tab is hidden, and keeps printed logos still. The main asset's known transparent margins are handled in the component's image placement so the whole wordmark is visible. The compact mark is also the favicon.

### Café overview: Le petit cinéma ARIMA

The café-only overview embeds five finished ARIMA films in animated vanilla, rose and pistachio scrapbook frames (`src/components/CafeCinema.tsx`, `src/cafe-cinema.css`). Handwritten notes, drawn arrows, sparkles and pointer tilt match the existing atelier design. Clicking opens an accessible native dialog with the complete video, sound and standard playback controls; Escape, backdrop and the close button restore focus and scrolling.

Assets live in `public/media/cafe-cinema/`: original full-quality MP4s, lightweight silent seven-second previews, JPEG posters and a local Caveat font. Only the visible active preview plays; hidden tabs and the full player pause the other previews. Mobile puts the featured film first. Music attribution is retained in `MUSIC-CREDITS.txt` beside the videos. No API or café data changes are required.

Validated with `npm run lint`, `npm run build`, desktop and 390 × 844 browser checks, playback of the original three full films, modal close/focus restoration and navigation to products.

### Separate café and administrator overviews

The café now opens on the first menu item, Vue d’ensemble. `CafeDashboardView` uses only that café’s issued invoices and orders, with purchase-side labels: Mes factures, Montant réglé, Reste à régler, order tracking and product quantities. The large welcome banner is removed from the café overview. The film showcase follows the financial summary. The administrator keeps its sales overview and has a separate Vidéos menu item. `tests/cafe-overview.test.ts` verifies ownership filtering, draft exclusion, rounded amounts and empty states; the backend suite continues checking server-side café isolation.

### GitHub and Vercel

Vercel serves the Vite build from `dist` and routes `/api/*` to `api/index.ts`. Production uses PostgreSQL through `DATABASE_URL` (or `POSTGRES_URL`), rather than an ephemeral SQLite file. Connect a PostgreSQL database to the Vercel project, then set `ADMIN_USERNAME`, a strong `ADMIN_PASSWORD` and optionally `SESSION_HOURS`. Production session cookies are always Secure and HttpOnly. Credentials and the local SQLite/legacy data are excluded from Git and Vercel uploads. The public product seed contains only the 29 product records.

For a one-time private migration of the existing local cafés, invoices, orders and account password hashes, pull the production environment into the ignored `.env.production.local` file and run `npm run db:migrate-production`. The migration refuses to overwrite a cloud database with existing café activity. Existing account passwords are preserved; local sessions are not copied. Never commit a database or environment file.

The five full café videos use complete 720p web encodes; their original high-quality masters remain in the separate local video workspace. `npm test` runs both local SQLite and real PostgreSQL-engine tests, including roles, ownership, transactions and invoice conversion. `npm run lint` and `npm run build` validate the application before publication.


### New tasting films — 20–21 November 2026

Two complete animated edits extend the showcase to five films: `en-famille` (2:11, Noisette and Classique in a square cup) and `a-partager` (1:04, Fraise, Oreo, Classique and Noisette). Product focus pauses use clean whole-product photographs, flavour ingredients drifting behind, handwritten callouts and tracked arrows. Original voices and creator marks remain. The source timeline is retained, including the four short inserted product holds in the second film.

The new films use full 720p MP4 web encodes, silent 360p seven-second previews and portrait posters. Only the visible active preview plays. A six-column desktop grid centres the last two frames; the featured new film appears first on mobile. Music attribution is available through the showcase footer. No backend records or account permissions are changed. The editable 1080p masters and detailed provenance remain in the local video workspace under `output/arima_pair_1548_20261120/`.

TypeScript excludes generated `dist`, `output` and ignored `tmp` maintenance files; application, backend, scripts and tests remain checked.
