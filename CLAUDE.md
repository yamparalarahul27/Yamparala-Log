# Working agreement

## Collaboration

- Before any non-trivial change (new deps, new files, architecture, security-sensitive code, "cleanup"), **stop and propose**. Wait for explicit approval.
- Never take autonomous decisions on design, path / folder structure, or dependencies.
- Give 2–3 options with a recommendation — not a single pre-decided path.
- When in doubt, ask.

## UI changes need ASCII first

For any UI/UX change beyond a one-line tweak, sketch the proposed layout in ASCII and get sign-off **before writing code**. Skip only for pure typography/color tweaks or restoring an existing spec.

Why: silent visual decisions burn time. ASCII forces a shared mental model before code.

## Behavioral rules

**1. Think before coding.** State assumptions explicitly. If multiple interpretations exist, present them. If a simpler approach exists, say so. If unclear, stop and ask.

**2. Simplicity first.** Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no flexibility/configurability that wasn't requested, no error handling for impossible scenarios. If 200 lines could be 50, rewrite. Ask "would a senior engineer call this overcomplicated?" — if yes, simplify.

**3. Surgical changes.** Touch only what you must. Don't "improve" adjacent code, formatting, or comments. Don't refactor what isn't broken. Match existing style even if you'd do it differently. Mention unrelated dead code — don't delete. Remove orphans your changes created; leave pre-existing dead code alone unless asked. Test: every changed line should trace directly to the user's request.

**4. Goal-driven execution.** Transform tasks into verifiable goals. "Add validation" → "write tests for invalid inputs, then make them pass." "Fix the bug" → "write a test that reproduces it, then make it pass." Loop until verified.

These bias toward caution over speed. For trivial tasks, use judgment.

## Project conventions

### File size

- 700 LOC cap for all files under `src/`. Excludes generated files, tests, lockfiles, `*.d.ts`.
- Split by responsibility before a file hits the cap: extract hooks, components, utilities, types into their own files.
- Prefer colocation over deep nesting — types near usage, helpers near callers.
- Vendored third-party code is exempt.

### Secrets & environment

- No hardcoded secrets, tokens, or API keys — ever.
- `.env*` files are never committed.
- API keys and service-role keys live on the server only. Never `VITE_*` for anything sensitive — `VITE_*` values are inlined into the browser bundle at build time.
- Never log secret values or tokens.
- Never include secret values in error responses, client payloads, or toast messages — return generic `{ error: "…" }`.
- No default credentials, example keys, or placeholder tokens. Use env-var reads that fail loudly on missing values in production.
