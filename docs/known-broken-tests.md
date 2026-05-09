# e2e suite — repair history

## Status: passing as of PR #4 (May 2026)

The two surviving tests in [`tests/resources.spec.ts`](../tests/resources.spec.ts) pass locally and in CI.

## What was wrong (Jan 2026 → May 2026)

For ~4 months the suite was red on every CI run. Three test failures:

- `tests/resources.spec.ts:56` — *creates the first saved resource*
- `tests/resources.spec.ts:74` — *shows tool subcategories for tool resources*
- `tests/resources.spec.ts:94` — *filters, edits, and deletes resources*

Root causes, once investigated:

1. **`tools` category was removed.** Commit `704b53b` ("Update categories to Article, Portfolio, Dev, Design, Others", Apr 2026) dropped `Tools` from the category list. Test `:74` clicks `getByRole("option", { name: "Tools" })` — that option no longer exists, so the click times out at 30s.
2. **Edit / delete moved behind the admin gate** ([`AdminGate.tsx`](../src/app/components/AdminGate.tsx)). Test `:94` tries to click `getByLabel("Edit Aceternity components")` while in the read-only state, but the edit/delete icons only render when admin mode is on.
3. **Server-side search arrived in PR #4** (cursor pagination + `or=(...)` ilike). The mock at `mockResourceApi` ignored URL params and always returned the full row list, so `expect("React docs").not.toBeVisible()` failed once the app stopped client-filtering.
4. Test `:56` was probably collateral damage — it passed locally even with the others red, but the CI job hit timeouts when other tests starved the worker pool.

## Fix in PR #4

- **Test `:74`:** deleted. The feature it tests (tool subcategory chosen via "Tools" category) is unreachable through the current UI. Re-adding "Tools" purely to keep the test alive would be reverse-engineering tests-as-spec.
- **Test `:94`:** updated. Mock now honors PostgREST's `or=(title.ilike."*q*",…)` filter and the `saved_at=lt.<cursor>` cursor and `limit=N` so it behaves like the real backend. The edit/delete portion now unlocks admin first via the in-app passcode `0125k` (UI gate, not real auth).
- **`mockResourceApi`:** generalized to mirror server behavior under cursor pagination + server-side search. Future tests that need a paged or filtered fetch can rely on this.

## How to verify locally

```bash
npx playwright test tests/resources.spec.ts --reporter=list
```

Should report `2 passed`. Trace + screenshots land under `test-results/` if anything regresses.
