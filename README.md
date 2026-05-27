# Prism

A self-serve web UI for applying pride labels to your Atmosphere/Bluesky profile.

Built by [Nyxorium](https://github.com/Nyxorium).

## How it works

Users sign in with an app password, pick their pride labels from a curated list, and Prism applies them via an Ozone labeller — no firehose, no persistent process, just a serverless function that fires on demand.

## Project structure

```
Prism/
├── functions/
│   └── api/
│       ├── label.ts       ← POST /api/label — apply or remove a label
│       └── labels.ts      ← POST /api/labels — fetch current labels on login
├── src/
│   ├── labels.ts          ← ⭐ single source of truth for label definitions
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── index.html
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Adding or editing labels

Edit `src/labels.ts` — this file is imported by both the frontend and the Pages Functions, so changes propagate everywhere automatically.

```ts
export const LABELS: Label[] = [
  { id: "your-label-id", name: "Display Name" },
  // ...
];
```

The `id` must match the label identifier in your Ozone labeller service exactly.

## Cloudflare Pages setup

**Build settings:**
- Build command: `pnpm build`
- Build output directory: `dist`

**Environment variables / secrets:**

| Name | Description |
|------|-------------|
| `LABELLER_DID` | DID of your Ozone labeller account |
| `LABELLER_HANDLE` | Handle of your labeller account |
| `LABELLER_APP_PASSWORD` | App password for the labeller account |
| `LABELLER_SERVICE_URL` | URL of your Ozone instance (e.g. `https://ozone.example.com`) |

## Local development

```bash
pnpm install
pnpm approve-builds  # first time only
```

Copy `.dev.vars.example` to `.dev.vars` and fill in your credentials:

```bash
cp .dev.vars.example .dev.vars
```

Then:

```bash
pnpm dev
```

Opens at `http://localhost:5173`.