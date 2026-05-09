# Known: Playwright e2e suite is broken

The Playwright tests in [`tests/resources.spec.ts`](../tests/resources.spec.ts) have been failing on every CI run since the workflow was added in January 2026.

Confirmed by `gh run list --workflow=ci.yml` — every recorded run on `main` and on feature branches is `failure` or `cancelled`. Build, install, and the Vercel preview deploy are the only currently green signals from CI.

## Failing tests

- `tests/resources.spec.ts:56:1` — creates the first saved resource
- `tests/resources.spec.ts:74:1` — shows tool subcategories for tool resources
- `tests/resources.spec.ts:94:1` — filters, edits, and deletes resources

Representative failure (test :94):

```
Error: expect(locator).toBeVisible() failed
  Locator: getByText('Aceternity components')
  Timeout: 5000ms
  Error: element(s) not found
```

…fired right after `await page.getByLabel("Search resources").fill("Aceternity")`.

## Likely cause

Not yet diagnosed. Plausible candidates, in rough order of likelihood:

1. The spec's mocked Supabase API in `mockResourceApi` (line 14) no longer returns rows in the shape the current `resources-client.ts` expects — schema drift between the table migrations (`tool_subcategory`, `image_url`, `tags`, etc.) and the mock fixtures.
2. The app's filtering / search logic now reads from fields the mock doesn't populate (e.g. `tags`, `description`).
3. Test selectors drifted from current DOM structure.

## What this PR did NOT do

This PR (working agreement + Resources.tsx split + bookmarks plan + CI install fix) deliberately did not attempt to repair these tests. The failures predate the branch. Per the working-agreement "surgical changes" rule, the test breakage is logged here and tracked as separate work.

## Suggested next step when picking this up

1. Run `npm run build && npm run test:e2e` locally to reproduce against the current code.
2. If it reproduces, diff `mockResourceApi`'s `ResourceRecord` shape against the live `Resource` interface in [`src/app/components/types.ts`](../src/app/components/types.ts) — start with the fields added since January (image_url, tags, description, tool_subcategory).
3. Update the spec's seed data + selectors as needed. Don't change the app to make the tests pass; the app is the source of truth.
