# Quick Apply Mosaic

Client-side batch image mosaic editor + image scramble tool. Two modes: mosaic (paint privacy effects) and scramble (pixel-level obfuscation). Fully static — no server-side logic.

**Live:** https://wenbin1354.github.io/quick-apply-mosaic/

## Tech Stack

- Next.js 15 (App Router, static export only — no SSR/API routes)
- React 19, TypeScript 5
- Tailwind CSS v4, shadcn/ui (new-york style, Radix primitives)
- JSZip (mobile batch downloads)
- Vitest for tests

## Commands

| Action | Command |
|--------|---------|
| Install | `npm install` |
| Dev server | `npm run dev` (Turbopack, port 3000) |
| Lint | `npm run lint` |
| Build (GitHub Pages) | `npm run build` (output: `out/`, basePath: `/quick-apply-mosaic`) |
| Build (local preview) | `npm run build-local` (no basePath) |
| Serve local build | `npm run serve-local` (port 3001) |
| Test (watch) | `npm test` |
| Test (single run) | `npm run test:run` |
| Deploy | Push to `main` triggers GitHub Actions → GH Pages |

## Architecture

### Entry Flow

`app/page.tsx` — Tab switcher (Mosaic / Scramble), owns locale state
- Mosaic → `app.tsx` (MosaicFilterApp)
- Scramble → `scramble-app.tsx` (ScrambleApp)

Both apps receive `locale` and `onLocaleChange` as required props (controlled components). `page.tsx` is the single source of truth for locale (reads/writes localStorage key `mosaic-locale`).

### Mosaic Mode (`app.tsx`, ~1600 lines)

Two components in one file:
- **MosaicFilterApp** — parent; manages image list state, settings, uploads, drag/drop, batch processing, downloads
- **ImageEditor** — child; per-image dual-canvas (base + overlay), pointer event handling for brush strokes, zoom

Canvas strategy: dual stacked canvases per image (base + overlay). Mosaic algorithm builds pixel mask from strokes → averages block colors within masked regions.

### Scramble Mode (`scramble-app.tsx`)

Batch image pixel obfuscation — scrambles/unscrambles images using a key. Compatible with PicEncrypt (https://github.com/jiarandiana0307/PicEncrypt) and 小番茄图片混淆 (https://xfqtphx.netlify.app/).

Four scramble methods:
- **Tomato (小番茄)** — default. Gilbert space-filling curve with numeric key (default 1, range 0-1.618). Same algorithm as xfqtphx.netlify.app.
- **Block** — Divides image into NxM blocks, permutes via MD5-based Fisher-Yates shuffle
- **Row** — Per-row pixel x-coordinate shuffling
- **Pixel** — Full x+y coordinate shuffling (most thorough)

### Key Modules (`lib/`)

| File | Purpose |
|------|---------|
| `scramble.ts` | All scramble algorithms: Tomato (Gilbert curve), Block, Row, Pixel + MD5 shuffle |
| `download.ts` | Download filename builder |
| `locale.ts` | Locale resolution (zh/en from localStorage or browser) |
| `row-rules.ts` | Desktop grid layout (aspect-ratio tokens for smart rows) |
| `sanitize.ts` | Privacy: LSB clearing, PNG ancillary chunk stripping, EXIF removal |
| `utils.ts` | `cn()` — clsx + tailwind-merge |

All lib modules have corresponding `.test.ts` files.

### Layout

- **Desktop:** sticky sidebar (270px) + content area grid. Same pattern for both Mosaic and Scramble.
- **Mobile:** bottom action bar + floating FAB + slide-up control panel; downloads as ZIP via JSZip

### i18n

Static translation objects with `zh` and `en`. Locale owned by `page.tsx`, synced to both apps via props. Persisted in `localStorage('mosaic-locale')`.

## Conventions

- Everything is `"use client"` — pure client-side SPA using Next.js as static build tool
- UI components live in `components/ui/` (shadcn/ui generated)
- No API routes, no server components
- Tests use Vitest; test files colocated in `lib/`
- GitHub Pages deploy via `.github/workflows/deploy-pages.yml`
- Locale is a controlled prop — never duplicate locale state in child components
