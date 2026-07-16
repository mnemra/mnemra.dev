[doc("List available recipes.")]
default:
    @just --list

[doc("Local dev server.")]
dev:
    npm run dev

[doc("Static build to dist/ (validates all post frontmatter).")]
build:
    npm run build

# Astro's own TypeScript/component check (the `check` npm script). Named
# astro-check, not check, to avoid colliding with the full local-gate recipe
# below.
[doc("Astro TypeScript/component check (npm run check).")]
astro-check:
    npm run check

# Depends on `build`: `npm run verify` reads the built dist/, not src/, and
# this repo has no CI to catch a stale-dist false green later (see
# CLAUDE.md) — the dependency makes that mistake structurally impossible
# rather than merely documented.
[doc("DOM + SHALL-NOT verify harness (depends on build).")]
verify: build
    npm run verify

# The only pre-merge check this repo has — there is no CI; the Cloudflare
# Workers Build runs after merge, by which point it's already live.
[doc("Full local gate. Run this before every PR.")]
check: astro-check verify

# A real publish to https://mnemra.dev. Rarely needed: merging to main via
# the wired Cloudflare Git integration is the normal path.
[doc("Manual deploy fallback (astro build && wrangler deploy).")]
deploy:
    npm run deploy
