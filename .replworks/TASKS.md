# ClayTube — TASKS

Derived from PRODUCT_SPEC.md, ARCHITECTURE.md, TECH_STACK.md and the git history up to `bd82a9e` (2026-10-06).

## Status legend

- `DONE` — commit evidence exists in the git log.
- `VERIFY` — probably implemented or partly implemented, but the git log alone cannot confirm it. Check against the code and the spec.
- `TODO` — no evidence of implementation.
- `DRIFT` — implemented, but the behavior is not defined in PRODUCT_SPEC.md / ARCHITECTURE.md (violates INV-19). Decide: add to spec, or remove.

Each task lists its spec source and a done-when condition. "Done" always means the done-when condition holds, not just that a commit exists.

---

## 0. Decisions needed first (DRIFT)

These block a clean spec-to-code match, so resolve them before further feature work.

### T-000 `DRIFT` Automatic CNAME generation

- Evidence: `2a72c2e` (generate CNAME during build), then `7522305`, `c94eecb`, `781fba2`, `85b94b2` (moved to root, then to `public/`).
- Problem: custom domains / CNAME are not in PRODUCT_SPEC.md. ARCHITECTURE.md AR-16 / INV-12 also require identical Built Site content for identical inputs, so a CNAME source must live in Project Configuration or the Presentation Definition.
- Done when: either (a) PRODUCT_SPEC and ARCHITECTURE add a custom-domain setting to Site Settings with the CNAME rule, or (b) the feature is removed. Whichever is chosen, `claytube.config.yaml` handling in C3 matches it.

### T-001 `DRIFT` TED.com-inspired homepage

- Evidence: `c3c9cde`.
- Problem: PRODUCT_SPEC Section 6 and FR-09 define the design principles (large thumbnails, clean typography, editorial layout, minimal UI) but not a TED reference.
- Done when: the homepage and channel pages are checked against FR-09 and no dashboard-style UI, clutter or heavy filtering remains.

### T-002 `DRIFT` CHANGELOG automation workflow

- Evidence: `bd82a9e` (#14).
- Problem: TECH_STACK Section 6 defines the release workflow (tag trigger, version match, lint/format/test/build before publish, Trusted Publishing). A CHANGELOG workflow is not defined.
- Done when: TECH_STACK.md is updated to include it, or the workflow is removed. If kept, confirm it uses no long-lived token and stays out of the npm publish path.

### T-003 `DRIFT` Mock data and sample channel in the template

- Evidence: `c3c9cde` (mock `data/videos.json`), `024bed5` (channel `@cable8mm`).
- Done when: the Project Template ships a sane default `claytube.config.yaml` and no stale mock data, and C2 guarantees a new Project has no Content Snapshot (ARCHITECTURE C2).

---

## 1. Project setup and tooling (TECH_STACK Sections 1–5)

### T-100 `DONE` Initial Astro + TypeScript structure

- Evidence: `4a5cf87`.
- Done when: see T-101 to T-106 for the exact version constraints.

### T-101 `VERIFY` Runtime and version pins

- Source: TECH_STACK Section 1.
- Check in `package.json`: `engines.node` is 24.x, `"type": "module"`, TypeScript ^6, Astro 7.x, `yaml` ^2, `commander` ^15, Vitest ^5, ESLint ^10, `typescript-eslint` ^8, Prettier ^3, `@types/node` ^24. No `latest`, `*` or unbounded ranges. `package-lock.json` committed.
- Done when: every item above is true and `npm ci` succeeds on Node 24.

### T-102 `VERIFY` tsconfig and module rules

- Source: TECH_STACK Section 3.
- Check: `module` and `moduleResolution` are `NodeNext`; `outDir` is `dist-cli/`; relative imports use `.js`; `node:` prefix for built-ins; `import type` for type-only imports; no `@ts-ignore` / `@ts-expect-error`; no `tsx` / `ts-node` in the published CLI.
- Done when: `tsc` builds to `dist-cli/` cleanly and a grep for the forbidden patterns returns nothing.

### T-103 `DONE` Lint and Prettier

- Evidence: `35b6988`, plus format fix in `ea4a2cd`.
- Done when: `npm run lint` and `npm run format:check` exist and pass.

### T-104 `VERIFY` `bin` field and `npx` usage

- Evidence: `6bafd88`, `7da36ed`.
- Source: TECH_STACK Section 2.
- Done when: `package.json` exposes `claytube` in `bin`, and `npx claytube` works from a clean directory using only the published package contents (including `dist-cli/`).

### T-105 `VERIFY` Secrets hygiene

- Source: TECH_STACK Sections 5 and 7.
- Evidence: `39e3f7d` (`.env.example`).
- Check: `.env` is in `.gitignore`; `.env.example` has no real value; `YOUTUBE_API_KEY` is not written to config, JSON data, `dist/`, or referenced in Astro pages/layouts/components; no `PUBLIC_` exposure; `.env` is excluded from the npm package.
- Done when: a build of a site produces no occurrence of the key value in `dist/`.

### T-106 `DONE` Local development doc

- Evidence: `2c17133` (`npm link` added to `LOCAL_DEVELOPMENT.md`), `e9b8359`, `2d662da`.

---

## 2. Components (ARCHITECTURE Section 5)

### C1 — Command Interface

#### T-200 `DONE` CLI exists

- Evidence: `6bafd88`.

#### T-201 `VERIFY` Strict grammar and exit codes

- Source: ARCHITECTURE C1; TECH_STACK Section 3.
- Done when: only `init`, `sync`, `build`, `deploy` are accepted; only `--git` (init), `--config` and `--dry-run` (sync) exist; unsupported commands, options and arguments give a usage error; every failure exits non-zero and names its category and the affected item (ARCHITECTURE Section 9).

#### T-202 `DONE` CLI smoke tests

- Evidence: `ea4a2cd`.

### C2 — Project Initializer (`init`, FR-01)

#### T-210 `DONE` `claytube init`

- Evidence: `9dd2cd3`.

#### T-211 `VERIFY` Safety guarantees

- Source: ARCHITECTURE C2, Section 9.
- Done when: `init` never overwrites or deletes existing content; on failure it removes anything it created and leaves the target unchanged; the template contains no real credential.

#### T-212 `TODO` `--git` option

- Source: FR-01.
- Evidence: none in the log.
- Done when: `claytube init my-site --git` initializes version control in the new Project; without the flag it does not.

### C3 — Configuration Loader (FR-02, FR-05)

#### T-220 `DONE` Config loading for `claytube.config.yaml`

- Evidence: `9f59410`, `ea4a2cd` (tests).

#### T-221 `DONE` Channel URL parsing and normalization

- Evidence: `3a689b8`, `ea4a2cd` (tests).

#### T-222 `VERIFY` Validation rules

- Source: ARCHITECTURE C3, Section 9.
- Done when: missing or unreadable config, malformed channel URL (names the URL), empty channel list (at `sync`), and missing site title (at `build`) each give an explicit configuration error; config is returned exactly as written (no dedup, no ordering); C3 never reads or returns the credential.

#### T-223 `VERIFY` `--config` scope

- Source: FR-05; ARCHITECTURE Section 7.3.
- Done when: `--config` applies to that `sync` only; `build` always reads the default config; the Content Store location does not change.

### C4 — Sync Orchestrator (FR-03, FR-04, FR-08)

#### T-230 `DONE` Basic `claytube sync`

- Evidence: `eb67422`.

#### T-231 `VERIFY` Dedup and canonical order

- Source: ARCHITECTURE C4, AR-10, INV-10, INV-11.
- Done when: duplicate channel URLs are removed before retrieval; Channels are sorted by title ascending, then identifier ascending; Videos by published date descending, then identifier ascending; sorting happens only in C4.

#### T-232 `VERIFY` All-or-nothing commit (AR-08, INV-08)

- Done when: if any channel fails, nothing is committed and the stored snapshot is byte-identical to before; the commit is one atomic replacement.

#### T-233 `VERIFY` Snapshot replacement (AR-07)

- Done when: videos or channels no longer returned by the source are removed from the store after a successful sync.

#### T-234 `TODO` `--dry-run` and Change Report

- Source: FR-04, AR-09, INV-09.
- Evidence: none in the log.
- Done when: `claytube sync --dry-run` prints added / removed / changed Channels and Videos (identity by identifier only, AR-11), writes nothing, and its report is identical to the report from a real run on the same inputs. A missing stored snapshot counts as empty.

### C5 — Content Source Adapter

#### T-240 `DONE` YouTube API key required

- Evidence: `2c17133`.

#### T-241 `VERIFY` YouTube access rules

- Source: TECH_STACK Sections 1 and 3; ARCHITECTURE C5.
- Done when: only C5 touches the YouTube Data API v3, using built-in `fetch` (no `googleapis`); the key is read only from `process.env.YOUTUBE_API_KEY`; a missing key fails before any retrieval; the key never appears in any log or error message.

#### T-242 `VERIFY` Normalization and completeness

- Source: ARCHITECTURE C5, Section 2.
- Done when: Channel records have identifier, title, URL and thumbnail reference; Video records have identifier, title, channel identifier, published date, thumbnail reference and URL; all available videos per channel are retrieved (pagination handled).

#### T-243 `VERIFY` Error categories

- Done when: unresolvable URL gives an invalid channel URL error naming the URL; source rejection or unavailability gives a source error naming the channel.

### C6 — Content Store

#### T-250 `DONE` JSON data file in use

- Evidence: `fe93c15`, `c3c9cde` (`data/videos.json`).

#### T-251 `VERIFY` Atomic write and integrity

- Source: ARCHITECTURE C6, INV-07.
- Done when: replacement is atomic (write to a temp file, then rename); readers see a complete old or new snapshot; the file is UTF-8; it holds references only (no media) and no secrets; writes come only from C4.

### C7 — Site Builder (FR-06, FR-09)

#### T-260 `DONE` Homepage and channel pages

- Evidence: `fe93c15`, `92e121a`.

#### T-261 `VERIFY` Required fields displayed

- Done when: the built site shows Channel title, URL, thumbnail and Video title, associated Channel, published date, thumbnail, URL.

#### T-262 `VERIFY` Build rules

- Source: ARCHITECTURE C7, INV-12, INV-13, INV-15.
- Done when: `build` fails with a build error if no snapshot exists or the site title is missing; it preserves snapshot order everywhere; it never contacts YouTube or reads the credential; identical inputs give identical output; a failed build leaves the previous complete `dist/` or nothing; output is static with no server adapter or SSR.

#### T-263 `VERIFY` Astro resolution

- Source: TECH_STACK Section 3.
- Done when: Astro is resolved from the project's installed dependencies, never a global executable, and a clear error appears when Astro is not installed.

### C8 — Publisher (FR-07)

#### T-270 `DONE` GitHub Pages workflow

- Evidence: `c995a6c`, `2099c19`, `addfd35` (`astro.yml`, `deploy.yml` removed), `a138881` (`environment.url`).

#### T-271 `TODO` `claytube deploy` command behavior

- Source: FR-07, ARCHITECTURE C8.
- Evidence: the log shows a GitHub Actions workflow but no `deploy` CLI command commit.
- Done when: `claytube deploy` publishes the existing Built Site to GitHub Pages unchanged; it fails with a publish error if no complete Built Site exists; it never runs `sync` or `build`; it uses only environment-supplied authorization; it puts no secret in published output.

#### T-272 `VERIFY` Pages workflow rules

- Source: TECH_STACK Section 6.
- Done when: the workflow uses Node 24.x, `npm ci`, builds Astro, uploads `dist/` as the artifact, deploys with GitHub Pages actions, uses GitHub-provided permissions, and has no hard-coded credentials.

---

## 3. Tests (TECH_STACK Section 4)

### T-300 `DONE` Initial test suite

- Evidence: `ea4a2cd` (config loading, URL normalization, CLI smoke).

### T-301 `TODO` Unit tests for sync logic

- Done when: deterministic, network-free tests cover dedup, canonical ordering, change detection (added / removed / changed), dry-run writes nothing, and all-or-nothing behavior.

### T-302 `TODO` Unit tests for the Content Store and Site Builder

- Done when: tests cover atomic replacement, no-snapshot build failure, missing-title failure, and deterministic output.

### T-303 `TODO` Tests for error paths

- Source: PRODUCT_SPEC Section 9, Acceptance Criterion 10.
- Done when: tests cover invalid YouTube URL, missing `YOUTUBE_API_KEY`, and build failure, each producing an explicit error and a non-zero exit code.

### T-304 `VERIFY` Test separation

- Done when: test files are named `<implementation>.test.ts` and sit next to the implementation; real-network tests are separate from `npm run test` and from CI; no coverage threshold is enforced; no real key is required.

---

## 4. CI and release (TECH_STACK Section 6)

### T-400 `DONE` CI workflow

- Evidence: `2099c19`.

### T-401 `VERIFY` CI steps

- Done when: CI runs `npm ci`, lint, format check, tests and the production build, and fails when any of them fails.

### T-402 `TODO` Release workflow

- Evidence: none in the log (`bd82a9e` is a CHANGELOG workflow only).
- Done when: a pushed `v*.*.*` tag triggers a workflow that checks the tag matches `package.json` `version`, runs `npm ci`, lint, format check, test and build, then publishes to npm with Trusted Publishing (OIDC), with no `NPM_TOKEN`.

### T-403 `VERIFY` Package contents and license

- Done when: the package is MIT licensed; it includes `dist-cli/` and any template files the CLI needs at runtime; it excludes `.env` and development-only files.

---

## 5. Acceptance sweep (PRODUCT_SPEC Section 11)

Run end to end on a clean machine, using only the published package:

- [ ] AC-1 `claytube init my-site` creates a Project with no manual source edits.
- [ ] AC-2 One or more channels can be configured in `claytube.config.yaml`.
- [ ] AC-3 / AC-4 `claytube sync` produces usable channel and video data.
- [ ] AC-5 `claytube sync --dry-run` previews changes and writes nothing.
- [ ] AC-6 `claytube build` generates the portal.
- [ ] AC-7 The portal matches the content-focused design principles (FR-09).
- [ ] AC-8 `claytube deploy` publishes to GitHub Pages.
- [ ] AC-9 Repeating `sync` → `build` → `deploy` updates the site.
- [ ] AC-10 Invalid URL, missing key and build failure give explicit errors.

---

## Suggested order

1. T-000 to T-003 (settle the drift, since it changes the spec or the code).
2. T-234 (`--dry-run` / Change Report), T-212 (`--git`), T-271 (`deploy`). These are the missing user-facing commands and options.
3. T-231 to T-233, T-251 (sync correctness and atomicity), then T-301 to T-303 (tests).
4. T-402 (release workflow), then the VERIFY items, then the acceptance sweep.
