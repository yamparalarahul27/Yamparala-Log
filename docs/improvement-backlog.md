# Improvement backlog — full-project review

Status: **assessment only, nothing implemented.** Findings from a codebase review (July 2026). Each item needs its own decision round before code is written (per [CLAUDE.md](../CLAUDE.md)); UI items additionally need an ASCII layout pass.

Complements [feature-ideas.md](./feature-ideas.md) (new features) — this file tracks fixes and hardening for what already exists.

---

## Security

### S1. Telegram webhook accepts spoofed updates — **highest priority**

[telegram-webhook/index.ts](../supabase/functions/telegram-webhook/index.ts) accepts any POST and trusts `message.chat.id` from the request body. The `TELEGRAM_ALLOWED_CHAT_IDS` check compares against an attacker-supplied value, so anyone who discovers the function URL can claim an allowed chat ID and write arbitrary rows through the service-role client (and trigger outbound Telegram messages).

**Fix:** Telegram supports a `secret_token` on `setWebhook`, delivered back as an `X-Telegram-Bot-Api-Secret-Token` header on every update. Verify that header at the top of the handler (~5 lines + one new secret + re-registering the webhook). Exploitable today regardless of the site URL being unlisted, so this should land *before* the RLS work already tracked in CLAUDE.md's pre-public-release checklist.

### S2. Admin passcode is hardcoded

The passcode lives as a string literal in [AdminGate.tsx](../src/app/components/AdminGate.tsx) (and is repeated in [known-broken-tests.md](./known-broken-tests.md)) — committed to the repo and shipped in the JS bundle. It's a UI lock, not auth (documented in CLAUDE.md), but it violates the project's own "no hardcoded secrets, ever" rule and can't be rotated without a commit.

**Fix:** move it to a `VITE_ADMIN_PASSCODE` env var. (Still bundle-visible — real authorization remains the RLS/auth-gate item in CLAUDE.md.)

### S3. `fetch-metadata` is an open URL fetcher (mild SSRF)

[fetch-metadata/index.ts](../supabase/functions/fetch-metadata/index.ts) fetches any URL passed to it with no scheme or host restrictions.

**Fix:** allow only `http(s)` and reject private / link-local IP ranges before fetching.

---

## Correctness bugs

### C1. Category mismatch: `"Other"` vs `"Others"`

The webhook's `VALID_CATEGORIES` is `[Article, Portfolio, Dev, Design, Others]`, but `parseMessage` defaults to `"Other"` (singular) — a value not in the list — so untagged Telegram saves land under a category the UI may not surface, and the DB accumulates both spellings. The `/start` help text also still shows `#Tools`, removed in Apr 2026.

**Fix:** default to `"Others"` (decide whether to backfill existing `"Other"` rows), update the help text.

### C2. Duplicate detection is index-only, not enforced

[20260416_add_normalized_url_to_resources.sql](../supabase/migrations/20260416_add_normalized_url_to_resources.sql) adds a plain index on `normalized_url`, no unique constraint. Both writers (webhook, web dialog) do check-then-insert — racy, and any future writer that forgets the check silently creates dupes.

**Fix:** partial unique index (`where normalized_url is not null`) + handle the conflict error in writers.

### C3. Telegram follow-up "task" overwrites notes

In the webhook, a plain-text message within 1 minute of a save *replaces* `notes`. If the original save carried a note (`#tag message` format), it's silently lost.

**Fix:** append instead of replace (decide on separator), or store tasks in their own column.

---

## Tooling & CI

### T1. No `tsconfig.json` — TypeScript is never type-checked

`vite build` only transpiles. No tsconfig exists, so nothing runs `tsc` — not locally, not in CI. Likely the single highest-leverage tooling fix.

**Fix:** add a tsconfig (with the `@/` alias mirroring [vite.config.ts](../vite.config.ts)), add `"typecheck": "tsc --noEmit"`, run it in CI. Expect a first round of surfaced type errors to triage.

### T2. CI deletes the lockfile before installing

[ci.yml](../.github/workflows/ci.yml) works around the macOS-lockfile/rollup-optional-deps issue (npm/cli#4828) by removing `package-lock.json` — every CI run resolves fresh versions, so builds aren't reproducible. The underlying npm bug is fixed in the npm that ships with Node 20.

**Fix:** regenerate the lockfile once, switch CI back to `npm ci`.

### T3. No linter, no unit tests

Only 2 Playwright e2e specs exist. Pure functions begging for cheap unit coverage: [normalize-url.ts](../src/utils/normalize-url.ts), `buildSearchFilter` in [resources-client.ts](../src/services/clients/resources-client.ts), and the webhook's `parseMessage`. ESLint is absent entirely.

---

## Duplication & hygiene

### H1. `normalizeUrl` / `inferSource` implemented twice

Once in `src/` ([normalize-url.ts](../src/utils/normalize-url.ts), [resources-client.ts](../src/services/clients/resources-client.ts)) and again inside the webhook. If the two normalizers drift (the tracking-param lists are hand-synced), duplicate detection silently breaks across the Telegram vs web paths. Edge functions can't import from `src/`, so: shared `supabase/functions/_shared/` module on the Deno side + a unit test asserting parity with the `src/` version.

### H2. `ForAIContext.txt` is stale and contradicts CLAUDE.md

It mandates loading nine `.md` files that don't exist, forbids SQL ("Supabase KV Store only") in a project built on SQL migrations, and forbids things the project already does. Leftover scaffolding; any AI tool reading it gets instructions that conflict with CLAUDE.md. **Fix:** delete (or reduce to "see CLAUDE.md").

### H3. Smaller items

- README migration links use absolute paths from a local machine (`/Users/yamparalarahul/…`) and mention only 2 of the 7 migrations.
- `documentation/.DS_Store` is a tracked junk file (the folder contains nothing else).
- [Resources.tsx](../src/app/components/Resources.tsx) is at ~650 lines, close to the 700 LOC cap — the next feature there needs a split first.

---

## UI/UX

### U1. Filters and sort only apply to loaded pages — **structural**

Data arrives newest-first via cursor pagination (30/page), but category/source filters and sort run client-side over loaded rows only ([Resources.tsx](../src/app/components/Resources.tsx), filter/sort block). "Sort: oldest" shows the oldest *of the first 30*; a category filter shows only its loaded matches while more exist server-side. The filter dropdown options are also derived from loaded pages, so they grow as you scroll.

**Fix:** push category/source/sort into the PostgREST query (`eq.` / `order=` params on `getPage`). Also fixes the dropdown options.

### U2. Tasks tab only sees loaded pages

Pending tasks on resources beyond the loaded pages are invisible; the tab claims "No pending tasks" with no hint. **Fix:** dedicated query (`notes` non-empty, `task_done=false`) — small and complete.

### U3. List view ignores the active search

Grid view respects the search query; list view (`getAllLight`) silently shows everything. Same session, two views, different data. **Fix:** apply the search filter to the list-view path (client-side over the light payload is fine).

### U4. Dark-mode hover bug in list view

The list row hover class is `hover:bg-slate-50` with no `dark:` variant — hovering in dark mode flashes near-white. One-line fix.

### U5. Empty-state save button isn't admin-gated

The header "Save resource" button renders only for admins, but the empty-state "Save the first resource" button renders for everyone and the dialog will actually save (permissive RLS). **Fix:** gate it the same way (and it's another argument for the RLS work).

### U6. Search modal blanks results while searching

[SearchModal.tsx](../src/app/components/SearchModal.tsx) renders an empty list whenever `isSearching`, so results flicker out on each keystroke during the 250ms debounce + fetch. **Fix:** keep stale results visible until new ones arrive (React Query `placeholderData: keepPreviousData`).

### U7. Polish (grab-bag)

- No way to clear an active search without reopening the modal and deleting the text — an `×` on the search button would do.
- Completing a task removes it instantly with no undo — a sonner toast with an "Undo" action fits the existing setup.
- [AdminGate.tsx](../src/app/components/AdminGate.tsx)'s hand-rolled panel has no Escape-to-close and no focus trap — Radix Popover (already a dependency) provides both.

---

## Performance

### P1. No `staleTime` on the main resources query

React Query defaults refetch-on-window-focus to on; every tab switch back refetches page 1 and collapses the cache-mutated list. The list-view query already sets `staleTime: 60_000` — the main query in [useResources.ts](../src/app/hooks/useResources.ts) deserves the same.

### P2. All card images lazy-load, including above the fold

First visible cards are the LCP. Give the first ~3 images `loading="eager"` + `fetchpriority="high"`. Related: `proxyImage` requests a fixed 800px width regardless of layout — on 5-column desktop each slot is ~300px, so ~2.5× the needed pixels ship. A `srcset` with 2–3 weserv widths covers it.

### P3. CSS-columns masonry reflows on every page append

`columns-*` distributes top-to-bottom per column, so each infinite-scroll append redistributes *all* cards (visible jumping), and reading order runs down columns. Tolerable at current scale; the main source of scroll jank. Options: CSS grid with row-span estimation, small JS masonry, or accept an even-height grid. Needs an ASCII/approach round.

### P4. Tweet cards reserve a flat 400px

Short tweets leave a large blank block; tall ones still shift. Cheap fixes don't exist (Twitter's widget self-sizes); persisting rendered height is probably over-engineering. Parked.

### P5. three.js + react-three-fiber + drei back an unreachable view

`SHOW_GALLERY_VIEW_TRIGGER = false` in [Resources.tsx](../src/app/components/Resources.tsx) makes the gallery view unreachable. The chunk is lazy-loaded (users never download it), but it's three heavyweight deps and ~430 lines maintained for a disabled feature. Decision: re-enable, or remove the deps and park [CanvasGallery.tsx](../src/app/components/CanvasGallery.tsx) on a branch — the cosmos idea in [feature-ideas.md](./feature-ideas.md) may resurrect it.

---

## Suggested sequencing

Quick wins, small and independent:

1. **S1** webhook secret-token check
2. **C1** Other/Others fix
3. **T1** tsconfig + typecheck in CI
4. **U4** dark hover, **P1** staleTime, **P2** eager first images (one-to-few-line fixes)

Next tier: **U1** server-side filters/sort (structural, biggest UX payoff), **U2**, **U3**, **C2**, **T2**.

Everything else as decided. Nothing here is scheduled — pick per the working agreement.
