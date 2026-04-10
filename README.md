# Quick Apply Mosaic

Batch image mosaic editor with brush masking, drag-and-drop upload, ordering controls, and optional metadata stripping on download.

## Features

- Brush-based selective mosaic editing
- Batch process + ordered batch download
- Mobile-friendly pointer drawing support
- Optional metadata stripping on download (re-encode + LSB cleanup)
- Bilingual UI (简体中文 / English)

## Language behavior

The app chooses language with this priority:

1. `localStorage` value `mosaic-locale` (if previously selected)
2. Browser locale (`navigator.language`): starts with `zh` => Chinese, otherwise English

You can always switch language from the UI dropdown.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run lint
npm run build
```

## GitHub Pages deployment (auto)

This repo includes GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

On every push to `main`, it will:

1. Install dependencies
2. Run Next.js static export build
3. Deploy `out/` to GitHub Pages

### One-time GitHub setup

In your GitHub repository settings:

1. Go to **Settings → Pages**
2. Set **Source** to **GitHub Actions**

After that, pushing to `main` auto-deploys.

## Notes

- This project is configured for project-pages path `/quick-apply-mosaic` in production builds.
- If browser extensions inject attributes into `body/html`, hydration warning noise is suppressed in layout.
