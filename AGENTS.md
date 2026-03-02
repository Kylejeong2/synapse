# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Synapse is a Git-style conversation forking chat application. It uses TanStack Start (React SSR + Nitro), Convex (serverless DB), Clerk (auth), and the Vercel AI SDK for multi-model AI chat.

### Required Environment Secrets

| Variable | Purpose |
|---|---|
| `VITE_CONVEX_URL` | Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk auth publishable key |
| `OPENAI_API_KEY` | OpenAI API key (required for default model) |

Optional: `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `XAI_API_KEY` for additional AI providers.

### Running the Dev Server

```bash
pnpm dev
```

Starts Vite on port 3000. No separate Convex dev process is needed for the frontend — the `VITE_CONVEX_URL` env var points to the hosted Convex deployment.

### Gotchas

- **esbuild build scripts**: pnpm v10 blocks postinstall scripts by default. After `pnpm install`, run `pnpm rebuild esbuild` if the dev server fails to start (the error will mention missing esbuild binary).
- **Nitro preset**: The vite config uses `preset: "vercel"` for Nitro. This works fine for `pnpm dev` but means `pnpm build` produces Vercel-specific output, not a standalone server.
- **Environment validation**: `src/env.ts` uses `@t3-oss/env-core` with Zod to validate env vars at runtime. The app will crash at startup if required vars are missing.

### Available Commands

See `package.json` scripts. Key ones: `pnpm dev`, `pnpm check` (biome lint+format), `pnpm typecheck`, `pnpm test` (vitest), `pnpm build`.

### Pre-commit Hooks

Husky runs `pnpm pre-commit` (lint-staged with biome) and `pnpm typecheck` on commit.
