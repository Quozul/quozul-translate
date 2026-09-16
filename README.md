# qzl-translate

A minimal self-hosted translation web app: a Next.js 16 front end in
`app/`/`components/`, a small validated policy layer in `lib/`, and any
OpenAI-compatible completion server (MiLMMT / Hy-MT2 builds) behind
`/api/translate`.

## Requirements

- pnpm (`corepack enable`; see `packageManager` in `package.json`)
- Node.js ≥ 20
- A running OpenAI-compatible model server exposing `chat.completions`
  with the local model IDs listed in `lib/models.ts`

## Environment variables

| Variable                | Purpose                                             | Default                        |
| ----------------------- | --------------------------------------------------- | ------------------------------ |
| `OPENAI_API_KEY`        | Required; requests fail with 503 when unset         | —                              |
| `TRANSLATION_BASE_URL`  | OpenAI-compatible base URL                          | `http://127.0.0.1:9931/v1`     |

## Commands

```bash
pnpm dev          # dev server
pnpm test         # vitest: request lifecycle, reducer, policies, cache
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint (next/core-web-vitals + typescript)
pnpm build        # production build
```

## Behavior notes

- Translation runs automatically on a 400 ms debounce after typing stops,
  on desktop and mobile alike.
- **IME composition** never fires intermediate requests; work resumes when
  composition ends.
- **Model selection** in Settings is a *preference*, not a guarantee: if
  the selected family cannot serve the language pair (e.g. MiLMMT without
  an explicit source — MiLMMT names the source language in its prompt and
  has no detection mode), the request falls back to a family that can, in
  `MODEL_FAMILIES` order. The response includes the family that actually
  ran (`family` field, preserved on cache hits) plus the `preset`,
  `cached`, and server-measured `durationMs` used by the status line.
- **Preferences** (target, source, family, preset, per-language usage)
  persist in `localStorage` under `qzl.preferences.v1`. Reads are fully
  validated: malformed records fall back field-by-field, legacy `model`
  keys migrate, and bad usage counters are dropped rather than trusted.
- **Caching** (`lib/server/translation-cache.ts`) is process-local: TTL
  30 minutes, FIFO eviction (insertion order — reads do not refresh it),
  256-entry and 16 MiB budgets. It is shared across requests to the same
  Node process and resets on restart/module reload.
- **Status line** (`components/translator/translation-output.tsx`) sits
  below the translated text, together with loading and error messages.
  When the text is ready it reads
  `Translated by <family> (<preset>) in <duration>ms (cached)` — for
  example `Translated by MiLMMT (Balanced) in 812ms`. `durationMs` comes
  from the server; if a response omits it, the client falls back to its
  own round-trip measurement, and `"(cached)"` appears only for cache
  hits. With no provenance at all it degrades to `Translation ready`.
- **Request lifecycle** (`components/translator/use-translation-request.ts`):
  one owner per request — ID token, abort controller, deadline. Results
  and failures commit only while the request is still current, checked
  after full body consumption, so stale responses can never overwrite
  newer output.

## Primitive stack

The UI mixes two primitive libraries deliberately until a future
migration: the combobox (`components/ui/combobox.tsx`) wraps
**Base UI** (`@base-ui/react`, `render` convention); the sheet, select,
dialog, and button primitives wrap **Radix** (`radix-ui`, `asChild`
convention), while `components.json` still reports the shadcn
`radix-nova` style. When touching mixed composition, verify refs,
disabled state, and keyboard behavior against the actual underlying
library.

## Layout

```
app/                     Server Components + the one API route
components/translator/   client feature: reducer state, hooks, panes
lib/                     shared contract, validated preferences, registries
lib/server/              request resolution, prompts, provider adapter,
                         translation service, cache (all `server-only`
                         except the pure policy modules)
tests/                   vitest support (stubs)
```
