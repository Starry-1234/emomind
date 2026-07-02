# Frontend

> **Note (emomind-lg / M0)**: This README was copied from `emomind-sb`.
> The frontend's AI integration is being migrated from `difyApi.ts` to
> `langgraphApi.ts` in M5. Until then, the 6 files that import
> `difyApi` have been neutralized and the dev server may not work
> end-to-end. See `doc/langgraph-migration/08-frontend-migration.md`.

## Tech Stack

React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

## Start

```bash
bun install
bun run dev
```

Open http://localhost:5173

## Build

```bash
bun run build
```

## Lint

```bash
bun run lint
```

## E2E Tests (Playwright)

Requires Docker running:

```bash
docker compose up -d backend
bunx playwright test
```

## Code Structure

```
src/
  main.tsx           # App entry
  routes/            # Page components
  components/        # UI components
  hooks/             # Custom hooks
  services/          # API modules (langgraphApi [M5+], analysisApi; difyApi neutralized)
  client/            # Auto-generated OpenAPI client
```

## Generate API Client

After changing backend API routes:

```bash
bash ./scripts/generate-client.sh
```
