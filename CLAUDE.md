# mnemra.dev — repo context

This repo is the **landing site and blog** for Mnemra, live at https://mnemra.dev. It is *about* Mnemra; it is not Mnemra itself. The product — an MCP-native context layer (a memory server that agents talk to over MCP, backed by Postgres + pgvector, Apache-2.0) — lives in a separate repo. This repo only ever contains the marketing site and written content.

## Stack

- **Astro 6**, static output (`output: 'static'`), TypeScript strict.
- Deployed to **Cloudflare Workers** via `@astrojs/cloudflare` + Wrangler.
- Vanilla CSS with the Ironworks design tokens (below). **No** Tailwind, component libraries, MDX, RSS, analytics, or CMS — the site is intentionally minimal and fully static.

## Deploying — merging to `main` is the publish

Cloudflare's Git integration **is** wired. The "Cloudflare Workers and Pages" GitHub App runs a `Workers Builds: mnemradev` check on every push to `main` and publishes the result to https://mnemra.dev. There is no gap between merge and live, and no separate deploy step to forget: **merging a PR is the decision to publish.** Treat it that way — get sign-off before the merge, not before a deploy that never comes.

`just deploy` (`astro build && wrangler deploy`) is the manual fallback. You rarely need it.

Confirm a deploy ran for a given commit:

```
gh api repos/mnemra/mnemra.dev/commits/<sha>/check-runs \
  --jq '.check_runs[] | {name, conclusion}'
```

**There is no GitHub Actions CI in this repo.** The Workers Build is the only automated check, and it runs *after* merge — by which point the result is already live. `just check` on your branch is therefore the *only* pre-merge gate that exists. Nothing else will catch a break for you.

Both this repo and `mnemra-core` are **squash-merge only**.

## Blog authoring

- One post per file: `src/content/blog/<slug>.md`. The slug is the filename.
- Frontmatter is Zod-validated at build time. Required: `title`, `date` (ISO-8601), `summary` (1–280 chars). Optional: `tags` (string[]), `hero` (image), `draft` (bool, default false). A missing required field fails the build.
- Post-local images go in `src/content/blog/_assets/`; reference inline as `![alt](./_assets/name.png)`. The hero image uses the `hero` frontmatter field and renders as an optimized `<picture>`.
- **Diagrams** are authored in **D2**, compiled to SVG, and placed in `_assets/`. Generative image tools (e.g. Gemini/"nano banana") are for hero or section *art* only — never for labeled diagrams, which must be exact and versionable.
- `draft: true` excludes a post from the production build and the `/blog` index.

### Commands

`just` is the documented entry point; each recipe wraps a plain `npm run <script>` (see `package.json` if you need the underlying command directly).

- `just dev` — local dev server (`astro dev`).
- `just build` — static build to `dist/` (validates all post frontmatter).
- `just astro-check` — Astro's own TypeScript/component check (`astro check`).
- `just verify` — DOM + SHALL-NOT checks (form action, meta tags, no RSS/MDX/analytics, no horizontal overflow) against the built `dist/`. **Depends on `build`** in the justfile: the harness reads the built `dist/`, not `src/`, so verifying a stale build is a false green — and there is no CI to catch it later. That dependency is why `verify: build` exists rather than a comment asking you to remember to rebuild first: it makes the stale-`dist/` mistake structurally impossible instead of merely documented.
- `just check` — the full local gate (`astro-check` + `verify`). Run this before every PR; there is no CI behind it, so this is the only thing that catches a break.
- `just deploy` — manual deploy fallback (`astro build && wrangler deploy`). Rarely needed — see Deploying above.

### The verify harness pins landing copy verbatim

`tests/verify/run.mjs` asserts on exact strings lifted from `src/pages/index.astro` — hero copy, the fragment list, and the shared meta description reused across `description` / `og:description` / `twitter:description`. **Any landing-copy change breaks `just verify` until the harness is synced in the same change.** That coupling is deliberate: it makes approved copy hard to drift by accident.

When syncing, transcribe the new strings from `index.astro` rather than retyping them from a summary or a review thread, and pin a *distinctive phrase* per paragraph rather than a whole block — long-prose pins break on cosmetic punctuation edits without catching anything real. Update the assertion's label text alongside the string, so a failure names the thing it actually checks.

### Worktrees are usually not worth it here

`node_modules` lives only in the main checkout, so a fresh `git worktree` starts with no dependencies and cannot build or verify until a full `npm install` runs. This repo is small, single-purpose, and rarely worked in parallel, so that cost generally buys nothing — prefer a branch in the main checkout.

The exception is genuine concurrency: two changes in flight at once that must not see each other's working tree. Then a worktree earns its install. Note also that a worktree branches from a *commit*, so it will not carry uncommitted work from the main checkout — commit first, or the worktree silently starts from a base that's missing it.

## Ironworks design tokens

Warm near-black with brass accents; serif display, humanist body, mono for code.

```
--bg-base:        #1a1612
--bg-surface:     #2a2219
--brass:          #b08d57
--brass-light:    #d4af70
--brass-dark:     #8a6a35
--text-primary:   #e8e0d0
--text-secondary: #c8b898
--text-muted:     #a09080
--font-heading:   Cinzel
--font-body:      Source Sans 3
--font-mono:      IBM Plex Mono
```

Color must never be the only carrier of meaning (accessibility) — use shape and label too.

## Voice — anything published under the Mnemra name

Landing copy, blog posts, release notes, social posts, email. One line: **write like an engineer who respects the reader's time — technical, concrete, declarative, dry. No marketing, no hedging, no buzzwords.** Reference points: Dan Luu, Julia Evans, the Fly.io and Tailscale blogs, early Stripe engineering posts. This is a product register, dry and impersonal by design — a register choice, and not a licence to compress the reasoning out.

**Truth**

This one governs what may be *asserted*, rather than how a sentence is phrased, and everything below sits under it. It is a values position, not a style preference: it does not trade against reach, conversion, or momentum. A draft that buys visibility with an overclaim is out of bounds, not a tradeoff to weigh.

- **Present tense is reserved for what is true and runnable today.** Anything else is marked as intent in the sentence itself — "we're building toward", "target architecture", "planned for v1.0" — never present-tense-by-implication. Declarative phrasing and the bans on hedging govern *how* a claim is worded; neither one licenses present tense for something that isn't built.
- **Omission that leaves a false impression counts as shading.** Take a claim like "ships as a single binary, nothing else to run": it goes shaded the moment scale needs an external database and the sentence doesn't say so, because the claim is true of the default configuration, silent on the limit, and the reader carries away something nobody actually said. Put the limit in the sentence that makes the claim.
- **No fabricated social proof.** No invented users, no invented testimonials, no metric without its denominator.
- **This is a review criterion, not only an authoring note.** It binds the pass that clears copy to publish as much as the pass that writes it, and it covers landing copy, README, release notes, social posts, and launch material alike.

Dev-tools readers punish overclaiming. That's true, and it is a consequence of holding the rule rather than the reason to hold it.

**Attributes**
- **Terse** — no wasted content, with the relations left intact. Not short sentences: a long sentence is fine when every clause earns its place and the connectives carry the joins, and the real failure here is a run of short assertions with the logic between them left for the reader to splice. Cut a clause that adds nothing, but keep one whose removal would delete a relation, a purpose, or a qualification. The reference points above are the calibration — dense and plain, not clipped.
- **Concrete** — specific tech (Rust, pgvector, MCP, Postgres) beats abstract categories ("infrastructure", "solutions"); names and numbers over adjectives.
- **Declarative** — "Mnemra is X," not "Mnemra can be seen as X"; avoid hedging verbs (seems, might, could be) when you can just say it, and when X is true today. Where it isn't, the declarative sentence is about the intent ("we're building X"), not about X.
- **Show, don't tell** — a code snippet beats a paragraph describing the code; let the example carry the claim.
- **Chiselled** — every phrase earns its place; no throat-clearing ("In this post we'll explore…"), no padding, no "it's worth noting that".

**Never**
- Buzzwords / marketing verbs: unlock, leverage, empower, transform, revolutionize, seamless, synergy, robust, cutting-edge, best-in-class, next-generation, game-changing. If it could appear on a conference-booth sign, kill it.
- Outcome-promises without a mechanism ("10x your productivity", "agents that just work").
- Hedge-stacking and over-qualification — commit or don't. Naming a limit is not hedging, and it stays.
- Throat-clearing openers ("In today's rapidly evolving landscape of…").
- AI-tell parallel structures (escalating triples like "fast, flexible, and future-ready"; "not X but Y" with a strawman X; adjective stacks like "powerful, scalable, modern").
- Stock AI vocabulary: "delve into", "tapestry", "navigate the landscape", "at the intersection of", "paradigm shift".

**Register**
- The **landing page** and the GitHub profile both lead with the *why* — a small, plain-language paragraph on what Mnemra is for (shared context and memory for the agents and people working the same problems, built toward capturing what a team knows), before any spec detail. Prefer that paragraph over staccato spec-sheet fragments and constructed beats ("X in. Y out."); keep it concrete, declarative, dry, no marketing. Deployment and architecture detail sit below the why, not above it.
- **Blog posts** do more work than the landing: open with the problem, the observation, or the surprising fact, then keep the same concrete, no-fluff discipline. They explain; they don't just assert.

**Audience** — write to the primary reader: an engineer building on MCP, probably at an AI-native startup (10–80 engineers), already fluent in agents, RAG, vector DBs, and LLM APIs. They will stop reading if you explain what MCP is in the first paragraph, and they will not forgive surface-level framing. A secondary reader (an engineering lead evaluating infrastructure — cares about self-hosting, tenant isolation, compliance) will forgive technical depth but not demo-vibes with no substance.

**Terminology**
- **"Context layer"** — the positioning term for what Mnemra *is*.
- **"Memory server"** — acceptable alternative when "context layer" would repeat; not in the same paragraph.
- **"MCP-native"** — a claim that matters; use when protocol fit is the point.
- Prefer "self-hostable" over "on-prem", "managed tier" over "cloud offering", "alpha / beta / v1.0" over "release stages".
- Avoid "solution", "platform" (use "server" or "tool"), "AI-powered" (redundant here).

Voice rules are heuristics, not laws — if a piece works and breaks one, keep it. The Truth block at the top is the exception: that one is a law, and a piece that works by breaking it doesn't ship. When in doubt on anything else, write the sentence two ways and keep the one that leaves the relation between the ideas on the page rather than the one that came out shorter.
