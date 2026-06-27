# Lens Architecture Atlas

Lens Architecture Atlas is a Vite + React + TypeScript educational catalog for exploring simplified photographic lens formula archetypes. It provides searchable lens entries, category filtering, and diagram/detail views for comparing common optical architectures.

## Local Development

Install dependencies:

```sh
npm ci
```

Start the local development server:

```sh
npm run dev
```

## Build

Create a production build in `dist`:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Deployment

This project is configured for GitHub Pages. The Vite `base` path is set to:

```ts
"/lens-architecture-atlas/"
```

GitHub Actions runs `npm ci`, `npm run build`, and deploys the generated `dist` directory to Pages on pushes to `main`.

Published URL:

https://marquisladybug.github.io/lens-architecture-atlas/
