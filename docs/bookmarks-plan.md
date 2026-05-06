# Bookmarks feature — plan

Status: **deferred, not started.** Pick up here when ready. No code has been written for this feature; nothing in the repo references it yet.

## Goal

Add a "Bookmarks" section to the app: a lightweight place to save URLs, distinct from the rich Resources catalogue. Admin (the existing UI passcode gate) can create / edit / delete; everyone else views read-only.

## Requirements (from the original ask)

- New "Bookmarks" section/tab visible to all visitors.
- Multiple bookmarks supported.
- Admin-only writes (create / edit / delete). Non-admin sees read-only.

## Existing context worth knowing

- **Admin gate is UI-only.** The passcode lives in [AdminGate.tsx](../src/app/components/AdminGate.tsx) and Supabase RLS is fully public. "Admin only" here means "the UI hides the controls" — not real authorization. Anyone hitting Supabase directly can write. Bookmarks will inherit the same posture unless you tighten auth as a separate workstream.
- **Existing data-layer pattern** to mirror: [resources-client.ts](../src/services/clients/resources-client.ts) → [api-client.ts](../src/services/api-client.ts) → [useResources.ts](../src/app/hooks/useResources.ts) → component.
- **Tabs today:** Resources / Tasks, switched via `activeTab` state in [Resources.tsx](../src/app/components/Resources.tsx).

## Schema

New migration: `supabase/migrations/20260506_create_bookmarks.sql` (rename date if you start on a different day).

```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  notes text not null default '',
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bookmarks_saved_at_idx on public.bookmarks (saved_at desc);

alter table public.bookmarks enable row level security;

create policy "Public read bookmarks"   on public.bookmarks for select using (true);
create policy "Public insert bookmarks" on public.bookmarks for insert with check (true);
create policy "Public update bookmarks" on public.bookmarks for update using (true) with check (true);
create policy "Public delete bookmarks" on public.bookmarks for delete using (true);
```

Mirrors [`20260321_create_resources.sql`](../supabase/migrations/20260321_create_resources.sql). Lean schema on purpose — no category, source, tags, image, author. Bookmarks = quick-save link + optional note. If you ever want grouping/folders, add a nullable `group text` column in a follow-up migration.

## Layout — three options

### Option A — Compact list (recommended)

```
[ Resources ]  [ Bookmarks ]  [ Tasks ]
                  ↑ new

┌──────────────────────────────────────────────────────────────┐
│ Bookmarks                                                    │
├──────────────────────────────────────────────────────────────┤
│ Designer Tom                          youtube.com            │
│ for the curious builder in every viewer       [✎] [🗑]       │  ← admin-only
├──────────────────────────────────────────────────────────────┤
│ Anthropic engineering blog            anthropic.com          │
│                                                [✎] [🗑]      │
├──────────────────────────────────────────────────────────────┤
│ React 19 release notes                react.dev              │
│ Read the actions section first                  [✎] [🗑]     │
└──────────────────────────────────────────────────────────────┘
```

Empty state: friendly bookmark icon + "No bookmarks yet" + "+ Add the first bookmark" (admin-only).

- Dense, fast to scan, matches "quick save" semantics, smallest code surface.
- No thumbnails / no visual richness.

### Option B — Card grid (matches Resources visual language)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Designer Tom        │  │ Anthropic blog      │  │ React 19 release    │
│ youtube.com         │  │ anthropic.com       │  │ react.dev           │
│ "for the curious…"  │  │                     │  │ "Read actions first"│
│ Saved May 6  [Open] │  │ Saved May 5  [Open] │  │ Saved May 5  [Open] │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

- Visually consistent with Resources.
- More code (a `BookmarkCard.tsx`), more vertical space per item, blurs the line between Resources and Bookmarks.

### Option C — A + simple groups

Adds a `group text` column; bookmarks render under collapsible group headers ("Reading later", "Tools to try"). Adds a group picker in the dialog and a group filter.

- More structure.
- More ceremony for a feature framed as "quick saves." Defer until A is in use.

**Recommendation: A.** Lightweight, distinct from Resources, easy to evolve to B or C later.

## File plan

```
src/app/components/
├── BookmarksTab.tsx        (NEW — list, empty state, edit/delete wiring)
├── BookmarkDialog.tsx      (NEW — add/edit form; mirrors AddResourceDialog but minimal: title, url, notes)
└── types.ts                (EDIT — add Bookmark interface)

src/app/hooks/
└── useBookmarks.ts         (NEW — mirrors useResources pattern)

src/services/
├── api-client.ts           (EDIT — add `bookmarks: BookmarksClient`)
└── clients/
    └── bookmarks-client.ts (NEW — mirrors resources-client, no normalize-url, no metadata fields)

src/app/components/
└── Resources.tsx           (EDIT — add "Bookmarks" tab button, render BookmarksTab when active, hide "Save resource" button while on Bookmarks tab and surface "Add bookmark" instead)

supabase/migrations/
└── 20260506_create_bookmarks.sql  (NEW — see schema above; rename date when you start)
```

`Bookmark` type sketch for `types.ts`:

```ts
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  notes: string;
  savedAt: string;
}
```

`Resources.tsx` is 500 LOC today. Adding a tab button + conditional render adds ~15 lines — well under the 700 cap. If it ever crowds the cap, the natural next split is extracting the `tasks` tab content into its own `TasksTab.tsx`.

## Decisions to make before coding

These were the open questions when the work paused. Resolve before starting:

1. **Layout: A, B, or C?** (recommended **A**)
2. **Title** — required, or auto-default to hostname when blank? (recommended **required**, matches Resources)
3. **Tab order** — `Resources / Bookmarks / Tasks` (recommended) or `Resources / Tasks / Bookmarks`?
4. **Duplicate URL check** — Resources blocks duplicates. Bookmarks: also block, or allow? (recommended **allow** — bookmarks are casual; you may want to re-save with a new note)
5. **"Add bookmark" button placement** — in the hero card top-right where "Save resource" sits today, swapping label/handler based on the active tab. OK to do that swap?

## Suggested build order when you resume

1. Write the migration; apply it locally (`supabase db push` or via the Supabase dashboard).
2. Add the `Bookmark` type + `bookmarks-client.ts` + wire `apiClient.bookmarks`.
3. Add `useBookmarks` hook.
4. Build `BookmarksTab.tsx` and `BookmarkDialog.tsx` (mirroring [AddResourceDialog.tsx](../src/app/components/AddResourceDialog.tsx) but with only title / url / notes).
5. Wire the new tab into [Resources.tsx](../src/app/components/Resources.tsx) — tab button, conditional render, conditional hero button.
6. Verify in the browser: visitor view (no edit/delete), admin view (full CRUD), empty state, long titles/URLs (apply the same `min-w-0` / `shrink-0` lessons from [ResourceCard.tsx](../src/app/components/ResourceCard.tsx)).

## Things deliberately NOT in scope here

- Real auth / RLS tightening for either bookmarks or resources. Separate workstream — flagged in [CLAUDE.md](../CLAUDE.md) implicitly via the "admin gate is UI-only" reality.
- Decoding HTML entities in auto-fetched resource tags (`&quot;…&quot;` showing up in the UI). Different code path (metadata extractor, likely the telegram-webhook), unrelated to bookmarks.
- Importing existing Resources into Bookmarks or vice-versa.
