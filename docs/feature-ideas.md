# Feature ideas — backlog

Status: **deferred, not started.** Seeds only — each idea needs an ASCII layout pass and a decision round before any code is written (per [CLAUDE.md](../CLAUDE.md)).

These three ideas came out of using the catalogue. They are listed here so they aren't lost; none are scoped or scheduled yet.

---

## 1. Search as a modal

### What

Lift the current inline search input out of the resources hero and into a full-screen / centered modal opened with a button (and ideally `⌘K` / `Ctrl+K`).

### Why

- The inline input in [Resources.tsx](../src/app/components/Resources.tsx) is always visible, occupies hero real estate, and competes with category filter + add button on small screens.
- A modal gives more room to surface richer results — grouped by category, recent searches, keyboard navigation, type-ahead, etc.
- Matches the pattern users already know from Linear, Raycast, GitHub, Notion.

### Open questions (resolve before coding)

1. Trigger surface — a "Search" button in the hero, an icon-only button, or only the keyboard shortcut?
2. Keyboard shortcut — `⌘K` (collides with browser-bookmark on some setups) or `/`?
3. Results behaviour — does selecting a result scroll the underlying grid to that card, open the link, or open a detail panel? (we don't currently have detail panels.)
4. Does the modal also expose category / source / tool-subcategory filters, or does it stay search-only and leave filters in the hero?
5. Mobile: same modal at full height, or a different surface (bottom sheet)?

### Touch points

- [Resources.tsx](../src/app/components/Resources.tsx) — remove inline input, add trigger button, mount modal.
- New `SearchModal.tsx` (or reuse `ui/dialog`).
- [useResources.ts](../src/app/hooks/useResources.ts) — already takes `{ search }`; no API change needed.

### Not in scope here

- Server-side full-text search ranking. The current `ilike` on multiple columns is good enough until proven otherwise.

---

## 2. Cosmos-style navigation

### What

Replace (or supplement) the current category dropdown + linear card grid with a spatial "cosmos" view: categories as clusters / orbits, resources as nodes you can pan, zoom, and click into. Inspiration: [cosmos.so](https://www.cosmos.so/).

### Why

- The catalogue is becoming a personal map of interests; a spatial view makes adjacency and density visible in a way a list can't.
- The existing [CanvasGallery.tsx](../src/app/components/CanvasGallery.tsx) already proves we can render resources on a canvas — extending it from "wall of thumbnails" to "navigable space" is a natural next step.

### Open questions (resolve before coding)

1. **Replacement or alternate view?** Add a third tab (`Grid / Gallery / Cosmos`) or replace one of the existing views?
2. **Clustering rule** — by category, by source, by saved-date band, or computed (tag co-occurrence)?
3. **Interactions** — pan + zoom only, or also drag-to-rearrange (with persistence)? Persistence implies a position column or a separate `resource_positions` table.
4. **Empty / sparse categories** — how do single-item clusters render without looking broken?
5. **Performance budget** — current library is small (tens to low hundreds). Pick a rendering approach (DOM, SVG, canvas, WebGL) that survives 1k+ nodes without rewriting later.
6. **Mobile** — cosmos views are notoriously hard on small screens. Fall back to the list, or build a touch-first variant?

### Touch points

- New component, likely `CosmosView.tsx`, alongside [CanvasGallery.tsx](../src/app/components/CanvasGallery.tsx).
- Tab wiring in [Resources.tsx](../src/app/components/Resources.tsx).
- Possible migration if positions are persisted.

### Not in scope here

- Multi-user collaboration on the same cosmos.
- Animated transitions between grid and cosmos views — nice-to-have, not core.

### Decision needed before any code

This is the largest of the three by far. Worth an ASCII sketch round + a small spike (throwaway prototype on a branch) before committing to a real implementation.

---

## 3. Better parsing and auto-categorisation

### What

Improve the link-ingest pipeline so that:

- Title / description / source / author / image are extracted more reliably across site types (YouTube, X/Twitter, GitHub, blog posts, PDFs, Substack, etc.).
- Category is inferred when the user doesn't pass a `#Category` tag, instead of always defaulting to `"Other"`.

### Why

- Today, [telegram-webhook/index.ts](../supabase/functions/telegram-webhook/index.ts) falls back to `"Other"` when no `#Category` is provided (see `parseMessage`). A lot of links end up there and need manual re-categorisation in the UI.
- Metadata extraction varies in quality by site; some saves land with missing or wrong fields and have to be edited by hand.
- HTML entities are not decoded on the way in (`&quot;…&quot;` showing up in tags / titles) — flagged in [bookmarks-plan.md](./bookmarks-plan.md) as a separate workstream; this is the right place for it.

### Open questions (resolve before coding)

1. **Where does the work live?**
   - (a) Extend the existing edge function ([telegram-webhook/index.ts](../supabase/functions/telegram-webhook/index.ts)) — keeps everything server-side, same deploy path.
   - (b) New dedicated edge function (e.g. `extract-metadata`) called from both the Telegram webhook and a future "Save resource" button — better separation, more surface to deploy.
   - Recommendation: start with (a), extract to (b) when a second caller appears.
2. **Categorisation strategy** — rules (URL host → category map, e.g. `youtube.com → Watch`, `github.com → Tools`), an LLM call, or a hybrid (rules first, LLM as fallback)? LLM means a paid dependency, a key on the server, and a latency budget for the webhook reply.
3. **Confidence + override** — if we auto-pick a category, do we mark it as "auto" so the UI can prompt for confirmation, or just write it like a manual save?
4. **Per-site parsers** — do we keep a generic OG-tag scraper plus a small number of hand-rolled adapters for the sites we save most (YouTube, X, GitHub)? Or stay fully generic and accept lower quality on hostile sites?
5. **Failure mode** — current fallback is to save the URL with whatever fields we got. Keep that, or fail loudly when extraction is too poor?

### Touch points

- [telegram-webhook/index.ts](../supabase/functions/telegram-webhook/index.ts) — `parseMessage` and the metadata-fetch path.
- Possibly a new `supabase/functions/extract-metadata/` if option (b) is chosen.
- HTML entity decoding wherever extracted strings are written.
- Tests under [tests/](../tests/) covering: a YouTube link, an X link, a GitHub link, a generic blog post, a link with no OG tags at all.

### Not in scope here

- Re-running auto-categorisation over historical rows. Useful, but a separate one-shot script — not part of the live ingest path.
- A UI for managing the host→category map. Start as a constant in the edge function; only build a UI if the map grows past ~20 entries.

---

## Tools to check out

Not features — tooling worth evaluating before it's adopted. Listed so it isn't lost; nothing installed or scheduled.

### transitions.dev/refine — live transition tuning

- **What:** A CLI + AI-agent skill ([transitions.dev/refine](https://transitions.dev/refine)) that docks onto the running app and lets you tune CSS/Tailwind transitions live on a timeline, with an agent suggesting motion refinements. Run via `npx transitions-refine live` (Cursor / Claude Code / Codex integration; supports plain CSS, CSS Modules, styled-components, Tailwind, inline styles).
- **Why it might fit:** The motion system in [CLAUDE.md](../CLAUDE.md) leans hard on a fixed easing set and deliberate entrances/press feedback. A live tuner would make dialling those curves in on real components faster than editing-and-reloading.
- **Before adopting (decide first):** whether it's a dev-only dependency, how it interacts with our house easing tokens (does it produce one-off cubic-beziers we'd have to fold back into `var(--ease-*)`?), and whether the agent-poller mode is worth wiring into this project's workflow.

## How to pick the next one

When picking up from this list, do not start coding. Open the relevant section, resolve its "Open questions", produce an ASCII layout (for #1 and #2) or an interface sketch (for #3), get sign-off, then build.
