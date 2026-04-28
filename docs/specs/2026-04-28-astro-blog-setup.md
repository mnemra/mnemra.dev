---
status: locked
locked_date: 2026-04-28
target_repo: https://github.com/mnemra/mnemra.dev
related_research: frontend framework comparison (Astro 6 / Leptos / SvelteKit / others), 2026-04-24
review_pass: 2026-04-28 (infra reviewer + acceptance test reviewer); incorporations applied 2026-04-28
---

# Feature: Astro 6 landing + blog on mnemra.dev

> **Spec for:** mnemra blog launch
> **Date:** 2026-04-28
> **Design ref:** existing repo-root `index.html` (Ironworks tokens inlined); 2026-04-24 frontend framework comparison recommending Astro 6 for content-dominant sites

## Purpose

Convert the static `index.html` landing into an Astro 6 site so blog posts can ship from the same repo with native image handling, content-shape validation, and Cloudflare Pages auto-deploy — unblocking the first blog post ahead of the 2026-05-22 soft launch.

## Requirements

- The site SHALL render the existing landing-page content (wordmark, eyebrow, body copy, fragments list, waitlist form, footer, social links, SVG avatar) at `/` with visual parity to the current `index.html`.
- The site SHALL preserve all Ironworks design tokens (palette `#1a1612` / `#2a2219` / `#b08d57` / `#d4af70` / `#8a6a35` / `#e8e0d0` / `#c8b898` / `#a09080`, fonts `Cinzel` + `Source Sans 3` + `IBM Plex Mono`).
- The site SHALL display a pronunciation line `pronounced NEM-ra` in the landing page hero, positioned directly under the `MNEMRA` wordmark.
- The site SHALL expose a blog index at `/blog` listing all published posts ordered by `date` descending.
- The site SHALL render individual blog posts at `/blog/<slug>` from markdown files in `src/content/blog/`.
- The site SHALL validate every blog post's frontmatter against a Zod schema at build time; missing required fields SHALL fail the build.
- The site SHALL render hero images via `astro:assets <Picture>` to emit a `<picture>` element with `<source>` entries for avif and webp. Inline markdown images SHALL be processed by Astro's image pipeline: format optimization (webp/avif) SHALL apply to all inline images, and responsive `srcset` SHALL apply when the source asset's largest dimension exceeds Astro's responsive threshold (typically 640px). Native lazy loading SHALL apply to all inline images.
- The site SHALL build via `npm run build` and emit static output to `dist/`.
- The site MUST preserve the existing Cloudflare Pages auto-deploy connection — the build command and output dir SHALL be set so Cloudflare Pages picks up the new build without manual intervention.
- The site MUST preserve Open Graph and Twitter card meta tags exactly as in current `index.html` (title, description, og:image at `/og.png`, twitter:card `summary_large_image`).
- The site MUST preserve the favicon at `/favicon.png`.
- The site MUST preserve the Buttondown waitlist form action URL and POST behavior; the form SHALL submit to `https://buttondown.com/api/emails/embed-subscribe/peter.manahan` and open `https://buttondown.com/peter.manahan` in a new window on submit.
- The site MUST preserve the social-link footer (GitHub, Bluesky, LinkedIn) with current URLs.
- The build SHALL NOT break the live site at https://mnemra.dev — the cutover SHALL go through a Cloudflare Pages preview deploy that is verified before the production deploy lands.
- The implementing agent SHALL NOT add analytics, RSS, search, comments, MDX, or any blog UI features beyond list + read.
- The implementing agent SHALL NOT migrate or backfill blog content — exactly one placeholder post is delivered to verify the pipeline; real content authoring is out of scope.
- The implementing agent SHALL NOT add a CMS, headless backend, or runtime data store — the site is fully static.
- The implementing agent SHALL NOT change the live domain, the Buttondown integration, or the social URLs.
- The implementing agent SHOULD use TypeScript with `strict: true` (Astro default). The general project-wide preference is Rust over TS/JS; this spec carves out content sites as a documented exception per 2026-04-28.
- The implementing agent MAY restructure inline `<style>` from `index.html` into colocated component styles or a `src/styles/` directory if it improves maintainability without breaking visual parity.

## Out of Scope

- RSS feed
- Site search
- Comments / discussion
- MDX (markdown with embedded components) — plain markdown only in V1
- Analytics integration
- Custom blog theming beyond Ironworks token reuse
- Blog post tagging UI (tags are stored in frontmatter but no `/blog/tags/<tag>` route)
- Migration of any prior writing — none exists
- Multi-language / i18n
- Light-mode toggle
- Author pages (single-author site for now)
- Newsletter integration beyond the existing Buttondown waitlist on the landing page
- Hero-image generation pipeline (authors supply images; build optimizes them)
- Headless CMS (Decap, TinaCMS, etc.) — file-authored markdown only
- Custom 404, error pages — Astro default is sufficient for V1
- A11y audit beyond preserving current `index.html` semantics (no regression)

## Scenarios

### Scenario: Landing page renders with parity

**Given** a local `npm run build` followed by `npm run preview`
**When** a visitor opens the preview at `http://localhost:<port>/`
**Then** the page contains: the SVG avatar element, an `<h1>` with text `MNEMRA`, an element with text `pronounced NEM-ra` rendered immediately after the `<h1>`, an element with text `Context Layer — MCP` (eyebrow), all body copy paragraphs from current `index.html`, the fragments `<ul>` with all three list items, a `<form>` with `action="https://buttondown.com/api/emails/embed-subscribe/peter.manahan"`, and a footer containing the status line and three social `<a>` tags (GitHub, Bluesky, LinkedIn) with current URLs. **DOM-diff verification:** every CSS custom property defined on `:root` in current `index.html` exists with the same value on the new build's `:root`; `<meta>` tags for `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description` exist with values matching current production exactly.

### Scenario: Blog index renders with one post

**Given** a Cloudflare Pages preview build with exactly one published post in `src/content/blog/`
**When** a visitor opens `/blog`
**Then** the page displays a list with one entry showing the post title, date, and summary, linked to `/blog/<slug>`.

### Scenario: Blog post renders with image

**Given** a published post with frontmatter `title`, `date`, `summary`, `tags`, `hero` (a local image), and a body containing one inline `![alt](./local-image.png)` reference
**When** a visitor opens `/blog/<slug>`
**Then** the page renders the title, date, tags, the hero image as an optimized `<picture>` element with avif/webp sources and `loading="lazy"`, the body markdown as semantic HTML, and the inline image likewise optimized.

### Scenario: Build fails on invalid post frontmatter

**Given** a post in `src/content/blog/` whose frontmatter is missing the required `title` field
**When** an agent runs `npm run build`
**Then** the build exits non-zero with a Zod validation error naming the missing field and the offending file.

### Scenario: Production deploy via fresh Cloudflare Pages project

**Given** the Astro work is merged to `main` and the existing Cloudflare Pages project for mnemra.dev has been deleted by the maintainer
**When** the maintainer creates a new Cloudflare Pages project connected to the same `mnemra/mnemra.dev` repo with framework preset `Astro`, build command `npm run build`, output directory `dist`, and Node version 22 (via `.nvmrc` or env override)
**Then** the new Pages project builds the `main` branch, deploys to https://mnemra.dev (after the maintainer reattaches the custom domain), and serves the Astro-built landing + `/blog` + `/blog/hello-mnemra` correctly. **Note:** mnemra.dev has not been publicly announced; brief downtime during the delete-and-recreate window is acceptable.

### Scenario: Draft post excluded from production output

**Given** a blog post with `draft: true` in its frontmatter
**When** the production build runs
**Then** `dist/blog/<slug>/index.html` does not exist **and** `dist/blog/index.html` does not contain a link to `/blog/<slug>`.

### Scenario: Empty blog index renders empty-state copy

**Given** no non-draft posts in `src/content/blog/`
**When** a visitor opens `/blog`
**Then** the page returns HTTP 200 (or `dist/blog/index.html` is generated) and contains the literal text `No posts yet.` and zero `<a>` elements pointing at `/blog/<anything>`.

### Scenario: Build fails on missing hero image file

**Given** a post whose frontmatter contains `hero: ./missing-image.png` and no file exists at the referenced path
**When** the production build runs
**Then** the build exits non-zero with an error identifying the missing asset and the offending post file. Silent omission is not acceptable.

### Scenario: SHALL-NOT clauses verified mechanically

**Given** the production build completes successfully
**When** the build artifacts and config are inspected
**Then** all of the following hold: `dist/rss.xml` does not exist; `dist/feed.xml` does not exist; `astro.config.mjs` does not import or reference `@astrojs/mdx`; `dist/index.html` contains no `<script>` tags loading from known analytics domains (`plausible.io`, `googletagmanager.com`, `google-analytics.com`, `usefathom.com`, `mixpanel.com`, `posthog.com`); `astro.config.mjs` declares `output: 'static'`.

### Scenario: Static asset MIME types correct

**Given** the new Cloudflare Pages production deploy
**When** `curl -I https://mnemra.dev/`, `https://mnemra.dev/blog/`, `https://mnemra.dev/blog/hello-mnemra/` are issued
**Then** each returns HTTP 200 with `Content-Type: text/html` (or `text/html; charset=utf-8`); `https://mnemra.dev/favicon.png` returns 200 with `Content-Type: image/png`; no HTML response carries `Content-Type: application/octet-stream`.

### Scenario: Blog navigation back-link resolves

**Given** the production deploy
**When** a visitor on `/blog/hello-mnemra` activates the "← Blog" back link
**Then** the browser navigates to `/blog` (absolute path), not a relative URL that depends on Cloudflare path normalization.

## Data Model

**Entity: blog post (Astro Content Collection)**

Schema in `src/content.config.ts` using Zod via `astro:content`. One file per post under `src/content/blog/<slug>.md`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `title` | string | required, non-empty | Post title |
| `date` | date | required, ISO-8601 | Publication date; drives `/blog` ordering desc |
| `summary` | string | required, 1-280 chars | Used in `/blog` index card and `<meta name="description">` on the post page |
| `tags` | string[] | optional, default `[]` | Surface in post metadata; no tag-archive route in V1 |
| `hero` | image | optional | Astro Image asset; rendered as optimized `<picture>` at top of post |
| `draft` | boolean | optional, default `false` | When `true`, post is excluded from `/blog` and from the production build |

Slug is derived from filename (no `slug` frontmatter field).

## API Contract

Not applicable — fully static site.

## UI Behavior

- **Pronunciation line:** Directly under the `MNEMRA` wordmark `<h1>`. Renders as a small caps line in `IBM Plex Mono` or matching subdued style; color uses `--raw-text-muted` (`#a09080`); font-size approximately `0.75rem` to `0.875rem`; letter-spacing matches the eyebrow line. The literal text is `pronounced NEM-ra` (no extra punctuation; the word "pronounced" is lowercase, `NEM-ra` retains the capitalization shown). The implementing agent MAY wrap the cap text in a `<small>` or styled `<span>` as appropriate.
- **Blog index `/blog`:** Lists posts as cards/rows showing title, date (formatted as `Mon DD, YYYY` or ISO), summary, and tag chips. Most recent post first. Empty state ("No posts yet.") renders if no posts are published. Each entry is a clickable link to `/blog/<slug>` with the entire card as the hit target (or at least a 44×44px link area on the title).
- **Blog post `/blog/<slug>`:** Renders title (h1), date, tags, optional hero image, then the markdown body. A "← Blog" back link at the top of the page.
- **Responsive:** All pages preserve the existing landing-page mobile breakpoint behavior (`@media (max-width: 640px)` rules from current `index.html`). Blog pages SHOULD adapt to the same breakpoint with comfortable mobile reading width. **Verification:** Playwright (or equivalent headless browser) loads each page at viewport widths `375px` (small mobile) and `1440px` (desktop) and confirms no horizontal overflow at either width.
- **Navigation:** A simple top nav linking to `/` (home) and `/blog`. May be a single link if the implementing agent prefers minimal chrome on the landing page.

## Constraints

- **Framework: Astro 6.x** — pin in `package.json`. `npm create astro@latest` with TypeScript strict mode.
- **No new design dependencies.** Tailwind, DaisyUI, component libraries are out of scope. Continue using vanilla CSS with Ironworks tokens.
- **No new runtime libraries.** Markdown rendering uses Astro's built-in (remark/rehype) defaults; no `marked`, no MDX in V1.
- **Build target: static (`output: 'static'`)**. No SSR, no server endpoints, no Cloudflare Workers / Functions integration.
- **Output dir: `dist/`** to match Cloudflare Pages auto-detection.
- **Build command: `npm run build`**.
- **Node version:** Use the latest LTS available on Cloudflare Pages (currently Node 22 LTS). Pin via `.nvmrc` or `engines` in `package.json`.
- **Dependency tier:** All new deps SHALL use permissive licenses (MIT/Apache-2.0/BSD/ISC). Copyleft (LGPL/MPL/CDDL/EPL) requires pre-approval; strong copyleft (GPL/AGPL/SSPL) is blocked.
- **Live-site cutover model:** mnemra.dev has not been publicly announced; brief downtime during cutover is acceptable. The cutover SHALL be: (1) implementing agent builds and verifies locally via `npm run preview` and the in-repo test scaffolding; (2) PR opened, reviewed, squash-merged to `main`; (3) maintainer deletes the existing Cloudflare Pages project for mnemra.dev; (4) maintainer creates a new Pages project on the same repo with the explicit Astro framework preset, build cmd `npm run build`, output dir `dist`, Node 22; (5) maintainer reattaches the custom domain. The implementing agent SHALL NOT push to `main` directly; the ruleset enforces PR-required.
- **Test scaffolding (dev dependencies):** The spec requires several browser-level and DOM-level checks (visual element presence, meta-tag values, viewport overflow, Buttondown form behavior, navigation link resolution, MIME content-types, build artifact presence). The implementing agent SHALL add Playwright (or a comparable headless browser) and a DOM-parsing helper (Cheerio or equivalent) as `devDependencies` and provide an `npm run verify` script that exercises the SHALL-NOT mechanical checks (no RSS, no MDX, no analytics, output static) and the affirmative DOM checks (meta tags, custom properties, form action, social links). The spec does NOT require CI integration of these checks in V1; running `npm run verify` locally before opening the PR is sufficient.
- **Lighthouse target (not a merge blocker):** Lighthouse scores ≥95 across Performance, Accessibility, Best Practices, SEO are a TARGET for the production deploy, not an enforced merge gate. The implementing agent SHOULD run `npx unlighthouse` (or `lighthouse` CLI) against the local preview, capture the scores in the PR description, and flag any score below 95 with a brief explanation. Future enforcement via Lighthouse CI is recommended (out of scope for V1).
- **Repo layout:** New files live under `src/`, `public/` (move existing `favicon.png` and `og.png` to `public/`), `astro.config.mjs`, `package.json`, `tsconfig.json`, `.nvmrc`, `.gitignore` (extend existing). Existing root `index.html` is removed in the same commit that introduces the Astro version.
- **Branch protection:** Work on a feature branch (`feat/astro-blog` or similar). PR squash-merges to `main`.

---

## Tasks

### Task 1: Initialize Astro 6 in-place

**Files:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `.gitignore` (extend), `src/` (created), `public/` (created)
**Type:** frontend
**Depends on:** None

**What:** Run `npm create astro@latest` in the repo root with the empty-project template, TypeScript strict, no integrations beyond defaults. Pin Astro 6.x in `package.json`. Move `favicon.png` and `og.png` from repo root into `public/`. Extend `.gitignore` to include `node_modules/`, `dist/`, `.astro/`.

**Acceptance Criteria:**
- [ ] `package.json` exists with `astro@^6` in dependencies and `dev`/`build`/`preview` scripts wired
- [ ] `astro.config.mjs` declares `output: 'static'`, no integrations beyond defaults
- [ ] `tsconfig.json` extends `astro/tsconfigs/strict`
- [ ] `.nvmrc` pins Node 22 LTS (or current Cloudflare Pages default)
- [ ] `public/favicon.png` and `public/og.png` exist; root copies removed in same commit
- [ ] `.gitignore` includes `node_modules/`, `dist/`, `.astro/`
- [ ] `npm install && npm run build` succeeds and produces `dist/index.html` (placeholder is fine; landing migrated in Task 2)
- [ ] All new dependencies are permissively licensed (MIT / Apache-2.0 / BSD / ISC); copyleft and non-standard licenses require explicit pre-approval before install

**Test Expectations:**
- Verify `npm run build` produces a non-empty `dist/`
- Verify `npm run dev` starts the dev server without errors

### Task 2: Migrate landing page to `src/pages/index.astro`

**Files:** `src/pages/index.astro`, `src/styles/ironworks.css` (or colocated styles), root `index.html` (deleted)
**Type:** frontend
**Depends on:** Task 1

**What:** Port `index.html` to `src/pages/index.astro`. Preserve all visual elements (SVG avatar, wordmark, eyebrow, body copy, fragments, waitlist form, footer, social links). Preserve OG/Twitter meta. Preserve Cinzel/Source Sans 3/IBM Plex Mono Google Fonts link. Inline styles MAY move to a `src/styles/` file or a `<style>` block in the Astro component. Add the pronunciation line `pronounced NEM-ra` directly under the `MNEMRA` wordmark per the UI Behavior section.

**Acceptance Criteria:**
- [ ] `src/pages/index.astro` renders to `dist/index.html` after `npm run build`
- [ ] All Ironworks tokens preserved (verify CSS custom properties match current `index.html` values exactly)
- [ ] Pronunciation line `pronounced NEM-ra` renders directly beneath the `<h1>MNEMRA</h1>` element with subdued styling per UI Behavior section
- [ ] All OG/Twitter meta tags preserved with same values as current `index.html`
- [ ] Buttondown form preserved with same `action` URL and `onsubmit` window.open behavior
- [ ] Social footer links preserved with current URLs (GitHub, Bluesky, LinkedIn)
- [ ] Mobile breakpoint (`@media (max-width: 640px)`) styles preserved
- [ ] Root `index.html` removed in the same commit as `src/pages/index.astro` is added
- [ ] Visual diff against current production https://mnemra.dev shows only the added pronunciation line as a difference

**Test Expectations:**
- Manual: open `npm run preview` after build, compare against current production at https://mnemra.dev
- Manual: validate the Buttondown form POST opens the popup window correctly (no functional regression)

### Task 3: Content collection schema

**Files:** `src/content.config.ts`, `src/content/blog/.gitkeep`
**Type:** frontend
**Depends on:** Task 1

**What:** Define the blog content collection per the Data Model section. Use Zod via `astro:content` and the Content Layer API (Astro 5+ pattern). Schema enforces required fields and types; an `image()` helper handles the optional hero asset.

**Acceptance Criteria:**
- [ ] `src/content.config.ts` defines a `blog` collection with the schema specified in Data Model
- [ ] Required fields: `title`, `date`, `summary`
- [ ] Optional fields: `tags` (default `[]`), `hero` (image), `draft` (default `false`)
- [ ] `src/content/blog/` directory exists (with `.gitkeep` if needed)
- [ ] `npm run build` succeeds with the empty collection (no posts yet)

**Test Expectations:**
- Build succeeds with zero posts (verifies collection setup is non-blocking when empty)

### Task 4: Blog index page `/blog`

**Files:** `src/pages/blog/index.astro`
**Type:** frontend
**Depends on:** Task 3

**What:** List page that pulls all `blog` collection entries (excluding drafts in production builds), sorts by `date` descending, and renders each as a card per the UI Behavior section. Empty state shows "No posts yet." Style consistent with Ironworks tokens.

**Acceptance Criteria:**
- [ ] `npm run build` produces `dist/blog/index.html`
- [ ] Page lists all non-draft posts ordered by `date` desc
- [ ] Empty state renders "No posts yet." when collection is empty
- [ ] Each entry is a link to `/blog/<slug>` with title, formatted date, summary, tags
- [ ] Page uses Ironworks tokens for typography and color
- [ ] Mobile responsive (single-column at `<640px`)

**Test Expectations:**
- Build with zero posts → empty-state rendered
- Build with 2+ posts of varying dates → list ordered correctly desc
- Build with a draft post → draft excluded from listing

### Task 5: Blog post template `/blog/[...slug]`

**Files:** `src/pages/blog/[...slug].astro`
**Type:** frontend
**Depends on:** Task 3

**What:** Dynamic route rendering each blog post. Renders title, date, tags, optional hero via `<Picture>` (emits a `<picture>` element with avif + webp `<source>` entries), rendered markdown body. "← Blog" back link at top. Post `<title>` and `<meta description>` set from the post's frontmatter.

**Acceptance Criteria:**
- [ ] `npm run build` produces `dist/blog/<slug>/index.html` for each non-draft post
- [ ] Post renders title (`<h1>`), date, tags, hero (when present) as optimized `<picture>`, then markdown body
- [ ] Hero image uses `astro:assets <Picture>` with `loading="lazy"`, rendering a `<picture>` element with avif + webp `<source>` entries
- [ ] Inline markdown images receive format optimization from Astro's image pipeline; assets exceeding Astro's responsive threshold (typically 640px) render with responsive `srcset`
- [ ] The placeholder post's inline image asset is large enough to exercise the responsive `srcset` path (verifies the pipeline end-to-end)
- [ ] Document `<title>` is `{post.title} — Mnemra` (or similar consistent format)
- [ ] `<meta name="description">` set from post's `summary`
- [ ] OG image falls back to the global `/og.png` if post has no hero
- [ ] Back link to `/blog` is present and functional
- [ ] Mobile responsive

**Test Expectations:**
- Post with hero image → optimized formats present in `dist/_astro/`
- Post without hero → page renders cleanly, no broken references
- Post with inline image → image optimized
- Draft post → no output file generated in production build

### Task 6: Placeholder test post

**Files:** `src/content/blog/hello-mnemra.md`, `src/content/blog/_assets/<image>.png` (or wherever Astro convention puts post-local images)
**Type:** frontend
**Depends on:** Tasks 3, 4, 5

**What:** A single placeholder post with title, date, summary, one tag, an optional hero, and a short body (1-3 paragraphs) that includes one inline image reference. Post text is acceptably terse — exists only to verify the build + render pipeline. Mark it `draft: true` if Peter prefers the production launch to be content-clean; default is `draft: false` so the pipeline is verifiably end-to-end on first deploy.

**Acceptance Criteria:**
- [ ] `src/content/blog/hello-mnemra.md` exists with all required frontmatter fields populated
- [ ] Post body contains at least one inline image reference
- [ ] Hero image (if used) is a real asset, not a 1px placeholder
- [ ] `npm run build` produces `dist/blog/hello-mnemra/index.html`
- [ ] `dist/blog/index.html` lists the post
- [ ] Decision on `draft: true|false` is surfaced for Peter in the dispatch completion report

**Test Expectations:**
- End-to-end: build → preview → load `/blog` → click through to `/blog/hello-mnemra` → verify hero + inline images render with optimization

### Task 7: Local verification + maintainer-driven Cloudflare Pages cutover

**Files:** `package.json` (adds `verify` script), `tests/verify/*` (or equivalent location for the verify harness)
**Type:** infra + frontend
**Depends on:** Tasks 1-6

**What:** Build the harness that runs the SHALL-NOT and DOM checks locally, then deliver the package to the maintainer for production cutover. The implementing agent does NOT touch the live Cloudflare Pages project — that is the maintainer's step.

**Implementing-agent acceptance criteria:**
- [ ] `npm run build` produces `dist/` with all expected pages (`/`, `/blog`, `/blog/hello-mnemra`, `/favicon.png`, `/og.png`)
- [ ] `npm run verify` script exists and exercises every Scenarios block check that can be verified against `dist/` and a local `npm run preview` server
- [ ] All Scenarios in the spec pass when `npm run verify` runs against the local build (agent reports pass/fail per scenario in the dispatch completion report)
- [ ] Lighthouse run against local preview produces scores ≥95 across Performance/Accessibility/Best Practices/SEO; scores recorded in the PR description; any score <95 explained
- [ ] PR opened against `main` from a feature branch (squash-only per ruleset)
- [ ] PR description includes: local-build verify output summary, Lighthouse scores, and a "Maintainer cutover checklist" section reproducing the maintainer steps below

**Maintainer cutover checklist (executed after PR merge by Peter):**
- [ ] Pull `main`, run `npm install && npm run build && npm run preview` once locally to spot-check
- [ ] Cloudflare dashboard → Pages → delete the existing `mnemra.dev` project (or rename it as a temporary backup)
- [ ] Create a new Pages project connected to `mnemra/mnemra.dev`, framework preset `Astro`, build command `npm run build`, output directory `dist`, root directory blank, Node version 22 (set via Pages env var `NODE_VERSION=22` if `.nvmrc` is not auto-detected on the new project's build image)
- [ ] First deploy completes successfully on `main`; verify the auto-generated `*.pages.dev` URL serves the site
- [ ] Reattach the custom domain `mnemra.dev` to the new Pages project (Pages → Custom domains)
- [ ] Run `curl -IL https://mnemra.dev`, `https://mnemra.dev/blog`, `https://mnemra.dev/blog/hello-mnemra` — each returns HTTP 200 with `Content-Type: text/html`
- [ ] Confirm pronunciation line appears on https://mnemra.dev landing
- [ ] If the new deploy is broken: revert by re-creating the old project from the renamed backup OR by reverting to a pre-Astro commit on `main` (which then needs the original blank-build-command static-files Pages config). Document outcome in the PR.

**Test Expectations:**
- `npm run verify` runs cleanly green against local build; agent reports per-scenario pass/fail
- Lighthouse scores captured before PR open
- Post-cutover smoke: maintainer's curl checks all return 200 within 60 seconds of the Pages deploy completing

---

## Risks

- **Brief production downtime during cutover.** Maintainer-driven delete-and-recreate of the Cloudflare Pages project produces a window (typically 5-15 minutes including custom-domain reattachment) during which mnemra.dev resolves to nothing or to Cloudflare's default placeholder. This is acceptable because the site has not been publicly announced. **If the site has been announced by the time this work runs, this risk re-evaluates** and the spec should pivot to a parallel-Pages-project + DNS-cutover approach.

- **Maintainer-step config drift.** The maintainer cutover checklist in Task 7 codifies the Pages-project settings, but the maintainer applies them by hand in the Cloudflare dashboard. Future maintainers (or a re-creation event) need to redo this manually. Operational debt acknowledged; deferred to a future `wrangler.toml` or `pages.config.json` adoption pass.

- **Lighthouse target without enforcement.** The ≥95 target is a recorded number in the PR description, not a structural gate. Manual reporting can be skipped or incorrect. Mitigation: future addition of Lighthouse CI to the workflow as a required status check (out of scope for V1; flag for follow-up after CI lands).

- **Ironworks token migration fidelity.** Inlined styles in `index.html` are dense and color-precise. A mechanical port may drift on rgba opacity values, hover transitions, or breakpoint behavior. Mitigation: the DOM-diff scenario verifies CSS custom-property values exactly; a design reviewer additionally compares the local preview against current production for visual parity before merge.

- **TS/JS preference conflict.** General project-wide preference is Rust over TS/JS for new code. This spec adopts TS for content sites per 2026-04-28 acceptance — the rigor-vs-fluency tradeoff favors fluency on low-blast-radius static content. Future content-site decisions should reaffirm or revise. Not blocking; documented for posterity.

- **Buttondown form integration.** The current form is a vanilla HTML POST with a `target` attribute and `onsubmit` window.open. Astro's hydration model is opt-in; a static port preserves this exactly with no client JS needed. The verify harness exercises the form's POST action attribute and `onsubmit` handler explicitly.

- **First-time Astro for the implementing developer.** Prior frontend work has been SvelteKit-focused. Astro shares Vite + component model + content patterns with SvelteKit; transferable skill but not zero-cost. The dispatch envelope SHOULD include a pointer to Astro 6 docs (https://docs.astro.build/) and the framework comparison cited in frontmatter as background reading.

- **`<Picture>` component requires defined `src`.** Posts with no hero must guard the hero render with a conditional in the post template (Task 5). Without the guard, building a no-hero post throws. The verify harness covers both branches (hero-present + hero-absent) on the placeholder + a generated empty-hero variant.

## Changelog

- **2026-04-28 (post-design-review):** Fidelity fix to hero image AC. Earlier draft and Task 5 acceptance text said `<Image>`, but the Scenario "Blog post renders with image" required a `<picture>` element with avif + webp sources. Astro's `<Image>` component renders `<img srcset>` (webp-only); `<Picture>` is the component that emits `<picture>` with `<source type="image/avif">` and `<source type="image/webp">`. Acceptance text and Risk note now reference `<Picture>` consistently. Added an explicit AC for inline markdown image responsive `srcset`. No scope change — this aligns the implementation directives with the user-facing Scenario, which has always been the contract.

- **2026-04-28 (post-revision):** Inline-image AC refined. Astro's image pipeline does not emit `srcset` for assets below its responsive threshold (typically 640px); the previous AC language implied it would. Updated language to: format optimization always applies, responsive `srcset` applies when source dimensions exceed the threshold. Added an explicit AC requiring the placeholder post's inline asset to be large enough to exercise the `srcset` path — without that, the pipeline isn't verified end-to-end.

## Done Criteria

The spec is satisfied when:
- All 7 tasks pass their acceptance criteria
- The local `npm run verify` exits 0 with all Scenarios reported pass
- Lighthouse scores ≥95 across Performance, Accessibility, Best Practices, SEO recorded in the PR description (target, not gate; <95 explained)
- PR squash-merged to `main`
- Maintainer cutover checklist completed (Task 7 second checklist) — new Cloudflare Pages project active, custom domain reattached
- Post-cutover smoke: `curl -IL` against https://mnemra.dev, https://mnemra.dev/blog, https://mnemra.dev/blog/hello-mnemra all return HTTP 200 with `Content-Type: text/html`
- Pronunciation line `pronounced NEM-ra` visible on the production landing
- Tracking system reflects task completion (workspace-internal)
