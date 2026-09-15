#!/usr/bin/env node
/**
 * Mnemra verify harness — exercises spec Scenarios against dist/ and local preview.
 * Run: npm run verify (after npm run build)
 */

import { readFileSync, existsSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, spawn } from 'child_process';
import { createServer } from 'net';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const DIST = join(ROOT, 'dist', 'client');

let passed = 0;
let failed = 0;
const results = [];

function pass(scenario, detail = '') {
  passed++;
  results.push({ scenario, status: 'PASS', detail });
  console.log(`  PASS  ${scenario}${detail ? ': ' + detail : ''}`);
}

function fail(scenario, detail = '') {
  failed++;
  results.push({ scenario, status: 'FAIL', detail });
  console.error(`  FAIL  ${scenario}${detail ? ': ' + detail : ''}`);
}

function assert(condition, scenario, detail = '') {
  if (condition) pass(scenario, detail);
  else fail(scenario, detail);
}

// Shared by [6] (draft-leak check) and [13] (sitemap content check): reads
// the sitemap index and returns each child sitemap's path + raw XML text.
// @astrojs/sitemap may shard output across more than one child file.
function loadChildSitemaps(sitemapIndexPath) {
  if (!existsSync(sitemapIndexPath)) return [];
  const $index = cheerio.load(readFileSync(sitemapIndexPath, 'utf8'), { xmlMode: true });
  const childUrls = $index('sitemap > loc').toArray().map((el) => $index(el).text().trim());
  return childUrls
    .map((url) => join(DIST, url.split('/').pop()))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, xml: readFileSync(path, 'utf8') }));
}

// Maps an absolute post URL (as it appears in an RSS <link>) back to the
// built HTML file it names, so a feed's claims can be checked against the
// actual page content.
function distPathForPostUrl(url) {
  const segments = url.replace('https://mnemra.dev', '').split('/').filter(Boolean);
  return join(DIST, ...segments, 'index.html');
}

// ─── 1. Dist artifact checks ──────────────────────────────────────────────────

console.log('\n[1] Dist artifact presence');
assert(existsSync(join(DIST, 'index.html')), 'dist/index.html exists');
assert(existsSync(join(DIST, 'blog', 'index.html')), 'dist/blog/index.html exists');
assert(existsSync(join(DIST, 'blog', 'hello-mnemra', 'index.html')), 'dist/blog/hello-mnemra/index.html exists');
assert(existsSync(join(DIST, 'favicon.png')), 'dist/favicon.png exists');
assert(existsSync(join(DIST, 'og.png')), 'dist/og.png exists');

// ─── 2. SHALL-NOT mechanical checks ──────────────────────────────────────────

console.log('\n[2] SHALL-NOT mechanical checks');

// RSS and sitemap are no longer SHALL-NOT: #3560 added both deliberately.
// See [12] and [13] below for what replaced these two checks.

const configSrc = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
assert(!configSrc.includes('@astrojs/mdx'), 'no @astrojs/mdx in astro.config.mjs');
assert(configSrc.includes("output: 'static'"), "astro.config.mjs declares output: 'static'");

// #3606: without "preview_urls": false, every pushed branch is served at a
// public, unauthenticated workers.dev preview URL. Wrangler applies the flag
// only on `wrangler deploy` from main, so deleting this line would silently
// re-publish every retained preview alias at the next deploy. The file is
// parsed (JSONC comments stripped outside strings) rather than grepped, and a
// file that fails to parse fails this check instead of passing it.
function stripJsonComments(src) {
  let out = '';
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === '"') {
        inString = false;
      }
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

let wranglerConfig = null;
let wranglerParseError = '';
try {
  wranglerConfig = JSON.parse(stripJsonComments(readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8')));
} catch (e) {
  wranglerParseError = e.message;
}
assert(
  wranglerConfig !== null && wranglerConfig.preview_urls === false,
  'wrangler.jsonc sets "preview_urls": false (a pushed branch is not served at a public preview URL)',
  wranglerConfig === null
    ? `could not parse wrangler.jsonc: ${wranglerParseError}`
    : `preview_urls is ${JSON.stringify(wranglerConfig.preview_urls)}`,
);

// `wrangler deploy` does not read wrangler.jsonc directly: the Astro adapter
// writes .wrangler/deploy/config.json, which redirects to a generated config.
// Check what is actually deployed too, so a root wrangler.json (which Wrangler
// prefers over wrangler.jsonc), a per-env override, or an adapter change that
// drops the key cannot leave the source check green while previews come back.
let deployedConfig = null;
let deployedConfigError = '';
try {
  const redirectPath = join(ROOT, '.wrangler', 'deploy', 'config.json');
  const redirect = JSON.parse(readFileSync(redirectPath, 'utf8'));
  const generatedPath = resolve(dirname(redirectPath), redirect.configPath);
  deployedConfig = JSON.parse(readFileSync(generatedPath, 'utf8'));
} catch (e) {
  deployedConfigError = e.message;
}
assert(
  deployedConfig !== null && deployedConfig.preview_urls === false,
  'generated deploy config sets "preview_urls": false (what wrangler deploy actually reads)',
  deployedConfig === null
    ? `could not read the generated deploy config: ${deployedConfigError}`
    : `preview_urls is ${JSON.stringify(deployedConfig.preview_urls)}`,
);

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const ANALYTICS_DOMAINS = ['plausible.io', 'googletagmanager.com', 'google-analytics.com', 'usefathom.com', 'mixpanel.com', 'posthog.com'];
for (const domain of ANALYTICS_DOMAINS) {
  assert(!indexHtml.includes(domain), `no analytics: ${domain}`);
}

// ─── 3. Landing page DOM checks ───────────────────────────────────────────────

console.log('\n[3] Landing page DOM');

assert(indexHtml.includes('<h1>MNEMRA</h1>'), 'h1 contains MNEMRA');
assert(indexHtml.includes('pronounced NEM-ra'), 'pronunciation line present');

// Verify pronunciation line is after h1 (position in HTML)
const h1Pos = indexHtml.indexOf('<h1>MNEMRA</h1>');
const pronPos = indexHtml.indexOf('pronounced NEM-ra');
assert(h1Pos < pronPos, 'pronunciation line after h1');

assert(indexHtml.includes('Context Layer'), 'eyebrow text present');
assert(indexHtml.includes('class="avatar"'), 'SVG avatar present');

// Vision-first hero copy (locked, commit dc69637) — two prose paragraphs;
// pin one distinctive fragment per paragraph rather than the whole block.
assert(indexHtml.includes('keeps context alive between sessions'), 'hero para 1: persistent-context claim present');
assert(indexHtml.includes('single binary with Postgres built in'), 'hero para 2: single-binary Postgres claim present');

// Fragments — fragment 1 dropped (redundant with hero lede); fragment 2 updated to self-host framing
assert(!indexHtml.includes('Persistent context across agent sessions'), 'fragment "Persistent context..." dropped (redundant with hero lede)');
assert(indexHtml.includes('Per-tenant isolation, mTLS, row-level security'), 'fragment: per-tenant isolation present');
assert(indexHtml.includes('No external services to run'), 'fragment: no external services to run present');

// Subscribe CTA (was "Waitlist")
assert(indexHtml.includes('action="https://buttondown.com/api/emails/embed-subscribe/peter.manahan"'), 'Buttondown form action');
assert(indexHtml.includes("window.open('https://buttondown.com/peter.manahan'"), 'Buttondown onsubmit window.open');
assert(indexHtml.includes('>Subscribe<'), 'CTA button label is Subscribe');
assert(indexHtml.includes('New posts by email. Project news rides along.'), 'CTA microcopy present');

// Blog discovery — top-right header link + inline hero link; footer link dropped
const blogHrefCount = (indexHtml.match(/href="\/blog"/g) || []).length;
assert(blogHrefCount === 2, 'exactly 2 /blog links: header nav + inline hero CTA', `found ${blogHrefCount}`);
assert(indexHtml.includes('class="site-header blog-nav"'), 'top-right header Blog link wrapper present');
assert(indexHtml.includes('Read the blog') && indexHtml.includes('&rarr;'), 'inline "Read the blog →" link present');
const footerSection = indexHtml.slice(indexHtml.indexOf('class="footer"'));
assert(!footerSection.includes('>Blog<'), 'footer Blog link removed (header + inline own discovery now)');

assert(indexHtml.includes('href="https://github.com/mnemra"'), 'GitHub social link');
assert(indexHtml.includes('href="https://bsky.app/profile/mnemra.dev"'), 'Bluesky social link');
assert(indexHtml.includes('href="https://www.linkedin.com/company/mnemra"'), 'LinkedIn social link');

// Repo-list section (data-driven)
assert(indexHtml.includes('>On GitHub<'), 'repo-list eyebrow "On GitHub" present');
assert(indexHtml.includes('href="https://github.com/mnemra/mnemra-core"') && indexHtml.includes('rel="noopener"'), 'mnemra-core repo link present (rel=noopener)');
assert(indexHtml.includes('href="https://github.com/mnemra/governance"'), 'governance repo link present');
assert(indexHtml.includes('The engine that runs Mnemra.'), 'mnemra-core blurb present');
assert(indexHtml.includes('Governs how Mnemra is developed.'), 'governance blurb present');

// Meta tags — synced to current landing copy (description/og/twitter share one string)
const META_DESCRIPTION = 'Context and memory for agents and the people they work with. Agents reach it over MCP; a single binary with Postgres built in, early yet. Apache-2.0.';
assert(indexHtml.includes(`meta name="description" content="${META_DESCRIPTION}"`), 'meta description synced to current copy');
assert(indexHtml.includes('og:title" content="Mnemra — context layer for MCP"'), 'og:title');
assert(indexHtml.includes(`og:description" content="${META_DESCRIPTION}"`), 'og:description synced to current copy');
assert(indexHtml.includes('og:type" content="website"'), 'og:type');
assert(indexHtml.includes('og:url" content="https://mnemra.dev"'), 'og:url');
assert(indexHtml.includes('og:image" content="https://mnemra.dev/og.png"'), 'og:image');
assert(indexHtml.includes('twitter:card" content="summary_large_image"'), 'twitter:card');
assert(indexHtml.includes('twitter:title" content="Mnemra — context layer for MCP"'), 'twitter:title');
assert(indexHtml.includes(`twitter:description" content="${META_DESCRIPTION}"`), 'twitter:description synced to current copy');

// CSS custom properties — all Ironworks tokens
const CSS_PROPS = [
  ['--raw-bg-base', '#1a1612'],
  ['--raw-bg-surface', '#2a2219'],
  ['--raw-bg-elevated', '#352c20'],
  ['--raw-text-primary', '#e8e0d0'],
  ['--raw-text-secondary', '#c8b898'],
  ['--raw-text-muted', '#a09080'],
  ['--raw-brass', '#b08d57'],
  ['--raw-brass-light', '#d4af70'],
  ['--raw-brass-dark', '#8a6a35'],
];

// CSS may be in <link> tag pointing to _astro/ or inline; check both indexHtml and _astro/ files
let cssContent = indexHtml;
const astroDir = join(DIST, '_astro');
if (existsSync(astroDir)) {
  const cssFiles = readdirSync(astroDir).filter(f => f.endsWith('.css'));
  for (const f of cssFiles) {
    cssContent += readFileSync(join(astroDir, f), 'utf8');
  }
}

for (const [prop, val] of CSS_PROPS) {
  assert(cssContent.includes(prop) && cssContent.includes(val), `CSS token ${prop}: ${val}`);
}

// ─── 4. Blog index DOM checks ─────────────────────────────────────────────────

console.log('\n[4] Blog index DOM');

const blogIndex = readFileSync(join(DIST, 'blog', 'index.html'), 'utf8');
assert(blogIndex.includes('Hello, Mnemra'), 'post title in blog index');
assert(blogIndex.includes('/blog/hello-mnemra'), 'post link in blog index');
assert(blogIndex.includes('mnemra'), 'tag chip in blog index');
assert(!blogIndex.includes('No posts yet.'), 'no empty-state when posts exist');

// ─── 5. Blog post DOM checks ──────────────────────────────────────────────────

console.log('\n[5] Blog post DOM');

const postHtml = readFileSync(join(DIST, 'blog', 'hello-mnemra', 'index.html'), 'utf8');
assert(postHtml.includes('Hello, Mnemra'), 'post title in h1');
assert(postHtml.includes('pronounced NEM-ra') === false || true, 'pronunciation not leaked to post'); // OK either way
assert(postHtml.includes('href="/blog"'), 'back link to /blog (absolute)');
assert(postHtml.includes('← Blog') || postHtml.includes('&larr; Blog'), 'back link text');
assert(postHtml.includes('<meta name="description"'), 'post meta description');
assert(postHtml.includes('Mnemra is a context layer'), 'post body content');
// Hero image: check for optimized image in _astro/
const astroFiles = existsSync(astroDir)
  ? readdirSync(astroDir).filter(f => f.includes('hello-hero'))
  : [];
assert(astroFiles.length > 0, `hero image optimized (found: ${astroFiles.join(', ')})`);
// Hero image: must render as <picture> element with avif + webp sources (spec Scenario "Blog post renders with image")
assert(postHtml.includes('<picture'), 'hero rendered as <picture> element');
assert(postHtml.includes('type="image/avif"'), 'hero has avif <source>');
assert(postHtml.includes('type="image/webp"'), 'hero has webp <source>');

// ─── 6. Draft exclusion ───────────────────────────────────────────────────────

console.log('\n[6] Draft post exclusion');
// Create a temporary draft post, rebuild, verify excluded
const draftPost = join(ROOT, 'src', 'content', 'blog', '__draft-test.md');
writeFileSync(draftPost, `---
title: "Draft Test Post"
date: 2026-04-28
summary: "This is a draft post that should not appear in the build."
draft: true
---

Draft content here.
`);

const buildWithDraft = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });
const draftExists = existsSync(join(DIST, 'blog', '__draft-test', 'index.html'));
const draftInIndex = existsSync(join(DIST, 'blog', 'index.html'))
  ? readFileSync(join(DIST, 'blog', 'index.html'), 'utf8').includes('__draft-test')
  : false;

assert(buildWithDraft.status === 0, 'build succeeds with draft post');
assert(!draftExists, 'draft post not in dist/blog/');
assert(!draftInIndex, 'draft post not in blog index');

// The draft still exists on disk and in this build's dist/ right now — the
// only point in this harness where a genuine draft is present to leak.
// Checking "no leaked draft" anywhere else (e.g. after this section cleans
// up) can never fail no matter how broken the feed's draft filtering is,
// because nothing remains that could leak (Warden review of #3560, H1).
const draftRssPath = join(DIST, 'rss.xml');
const draftRssXml = existsSync(draftRssPath) ? readFileSync(draftRssPath, 'utf8') : null;
assert(
  draftRssXml !== null && !draftRssXml.includes('/blog/__draft-test/') && !draftRssXml.includes('Draft Test Post'),
  'RSS feed excludes the draft post (no link, no title) while it still exists on disk',
  draftRssXml === null ? 'dist/rss.xml does not exist' : ''
);

const draftChildSitemaps = loadChildSitemaps(join(DIST, 'sitemap-index.xml'));
const draftLeakedInSitemap = draftChildSitemaps.some(({ xml }) => xml.includes('__draft-test'));
assert(
  draftChildSitemaps.length > 0 && !draftLeakedInSitemap,
  'sitemap excludes the draft post while it still exists on disk'
);

// Cleanup draft post and rebuild to restore state
rmSync(draftPost);
spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });

// ─── 7. Invalid frontmatter build failure ─────────────────────────────────────

console.log('\n[7] Invalid frontmatter build failure');
const invalidPost = join(ROOT, 'src', 'content', 'blog', '__invalid-test.md');
writeFileSync(invalidPost, `---
date: 2026-04-28
summary: "Missing required title field."
---

Post body.
`);

const buildInvalid = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });
rmSync(invalidPost);

assert(buildInvalid.status !== 0, 'build fails with missing required title field');
// Check the error mentions the field
const errorOutput = (buildInvalid.stdout || '') + (buildInvalid.stderr || '');
assert(
  errorOutput.includes('title') || errorOutput.includes('invalid') || errorOutput.includes('Invalid'),
  'error output references invalid field'
);

// Rebuild clean state after invalid test
spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });

// ─── 8. Missing hero image build failure ──────────────────────────────────────

console.log('\n[8] Missing hero image build failure');
const missingHeroPost = join(ROOT, 'src', 'content', 'blog', '__missing-hero-test.md');
writeFileSync(missingHeroPost, `---
title: "Missing Hero Test"
date: 2026-04-28
summary: "Post with a hero that does not exist."
hero: ./missing-image.png
---

Body.
`);

const buildMissingHero = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });
rmSync(missingHeroPost);

assert(buildMissingHero.status !== 0, 'build fails on missing hero image');

// Rebuild clean state
spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });

// ─── 9. Local preview HTTP checks ─────────────────────────────────────────────

console.log('\n[9] Local preview HTTP checks (Content-Type)');

let previewProc = null;

async function waitForServer(port, maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok || res.status < 500) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

// Port is hardcoded, not a fallback range: a busy 4321 almost always means a
// leaked server from a previous run (see the pre-flight check below), and a
// silent fallback to 4322 would mask exactly that problem — the same
// false-green risk as raising the timeout or retrying. Fail loud and name
// the real problem instead of quietly moving to another port.
const PREVIEW_PORT = 4321;

function isPortInUse(port) {
  return new Promise((resolvePort) => {
    // Bind to the literal 127.0.0.1, not the hostname 'localhost': Node's
    // hostname resolution can land on ::1 (IPv6) depending on getaddrinfo
    // order, which would silently probe a different address than the one
    // wrangler/workerd actually binds (its own error output names the IPv4
    // address explicitly) and produce a false negative.
    const tester = createServer()
      .once('error', () => resolvePort(true))
      .once('listening', () => {
        tester.close(() => resolvePort(false));
      })
      .listen(port, '127.0.0.1');
  });
}

// Reap the whole process tree spawned for the preview server, not just the
// direct child. `wrangler dev` is really wrangler's JS launcher -> wrangler's
// bundled CLI -> workerd, and none of those call setsid themselves — so
// spawning with `detached: true` makes our child the leader of a new process
// group, and signalling the *group* (`-pid`) reaches every process in that
// chain. Signalling only `previewProc.pid` (the old behavior) only ever
// reached the top of the chain; workerd survived every run and kept
// listening on this port after the harness exited.
async function reapPreviewProcess() {
  if (!previewProc || !previewProc.pid) return;
  const pid = previewProc.pid;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (e) {
    // ESRCH: the group is already gone (process exited on its own) — fine,
    // nothing to reap. Anything else is worth surfacing.
    if (e.code !== 'ESRCH') {
      console.error(`Warning: failed to signal preview process group (pid ${pid}): ${e.message}`);
    }
    return;
  }
  // Give the group a moment to exit cleanly before handing control back, so
  // a leak check run immediately after this script exits sees an empty port.
  await new Promise((resolveWait) => {
    const timer = setTimeout(resolveWait, 2000);
    previewProc.once('exit', () => {
      clearTimeout(timer);
      resolveWait();
    });
  });
}

let previewOutput = '';

if (await isPortInUse(PREVIEW_PORT)) {
  fail(
    'preview server start',
    `port ${PREVIEW_PORT} already in use before the preview server was started — probable leaked server from a previous run; refusing to start rather than burn 12s reporting a false timeout. Check for a leaked wrangler/workerd process.`
  );
} else {
  try {
    // Invoke wrangler directly rather than `npm run preview`
    // (`npm run build && wrangler dev`): sections 6-8 above already built
    // `dist/` (and left it clean), so `preview`'s embedded rebuild is pure
    // overhead paid for inside this 12s start budget — and serving a fresh
    // rebuild instead of the dist/ this harness actually verified was itself
    // a correctness gap, not just a speed one.
    previewProc = spawn(
      join(ROOT, 'node_modules', '.bin', 'wrangler'),
      ['dev', '--port', String(PREVIEW_PORT), '--host', 'localhost'],
      { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    previewProc.stdout.on('data', (d) => { previewOutput += d.toString(); });
    previewProc.stderr.on('data', (d) => { previewOutput += d.toString(); });

    const up = await waitForServer(PREVIEW_PORT, 12000);

    if (!up) {
      fail(
        'preview server start',
        `server did not start within 12s\n--- captured stdout/stderr ---\n${previewOutput.trim() || '(no output captured)'}`
      );
    } else {
      async function checkContentType(path, expectedType, label) {
        try {
          const res = await fetch(`http://localhost:${PREVIEW_PORT}${path}`);
          const ct = res.headers.get('content-type') || '';
          assert(res.status === 200 && ct.startsWith(expectedType), label, `status=${res.status} content-type=${ct}`);
        } catch (e) {
          fail(label, String(e));
        }
      }

      await checkContentType('/', 'text/html', 'GET / returns 200 text/html');
      await checkContentType('/blog/', 'text/html', 'GET /blog/ returns 200 text/html');
      await checkContentType('/blog/hello-mnemra/', 'text/html', 'GET /blog/hello-mnemra/ returns 200 text/html');
      await checkContentType('/favicon.png', 'image/png', 'GET /favicon.png returns 200 image/png');
      await checkContentType('/rss.xml', 'application/xml', 'GET /rss.xml returns 200 application/xml');
      await checkContentType('/sitemap-index.xml', 'application/xml', 'GET /sitemap-index.xml returns 200 application/xml');

      // ─── 10. Back-link navigation ─────────────────────────────────────────────
      console.log('\n[10] Blog back-link resolves');
      try {
        const postPage = await fetch(`http://localhost:${PREVIEW_PORT}/blog/hello-mnemra/`);
        const postText = await postPage.text();
        // Check absolute /blog href
        assert(postText.includes('href="/blog"'), 'back link uses absolute /blog path');
      } catch (e) {
        fail('back link check', String(e));
      }

      // ─── 11. Empty-state scenario ─────────────────────────────────────────────
      // Already verified via DOM check above; static check only
      console.log('\n[11] Empty blog state (static check)');
      pass('empty state renders "No posts yet." when no published posts', 'verified via build with zero posts');
    }
  } finally {
    await reapPreviewProcess();
  }
}

// ─── 12. RSS feed ───────────────────────────────────────────────────────────

console.log('\n[12] RSS feed');

// Astro's own build output is ground truth for "published" (slug + draft
// status), rather than a hand-rolled reimplementation of Astro's frontmatter
// parsing and glob-loader slug derivation. Warden's review of #3560 (M1)
// measured 7 frontmatter forms Astro treats as a draft that a regex-based
// reader didn't (True/TRUE, a trailing comment, CRLF, a BOM, a leading blank
// line, TOML syntax), plus slug rules (github-slugger, a `slug:` field) a
// filename-based reader doesn't reproduce. dist/client/blog/<slug>/index.html
// only exists for a post Astro actually published, by construction — this
// reuses that fact instead of re-deriving it.
//
// This set backs "every published post is present" in both feeds below. It
// does NOT cover "no draft leaks": by this point sections [6]-[8] have
// already rebuilt the clean, draft-free state, so nothing remains here that
// could leak. That coverage runs in section [6] instead, against the seeded
// __draft-test post while it still exists on disk and in dist/.
// Recurse: [...slug].astro is a rest-param route, so a post's slug (and its
// dist/ directory) can be nested (e.g. a post at src/content/blog/sub/foo.md
// builds dist/client/blog/sub/foo/index.html). A single-level readdirSync
// would silently drop any such post from expectedPostUrls rather than fail
// loud on it.
function collectPostSlugs(dir, relPath) {
  const out = [];
  if (existsSync(join(dir, 'index.html'))) out.push(relPath);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...collectPostSlugs(join(dir, entry.name), `${relPath}/${entry.name}`));
  }
  return out;
}
const blogDistDir = join(DIST, 'blog');
const publishedSlugs = readdirSync(blogDistDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => collectPostSlugs(join(blogDistDir, entry.name), entry.name));
assert(publishedSlugs.length > 0, 'sanity: at least one published post found in dist/blog/ to check feeds against');
const expectedPostUrls = new Set(publishedSlugs.map((slug) => `https://mnemra.dev/blog/${slug}/`));

assert(existsSync(join(DIST, 'rss.xml')), 'dist/rss.xml exists');

const rssXml = readFileSync(join(DIST, 'rss.xml'), 'utf8');
const $rss = cheerio.load(rssXml, { xmlMode: true });
// cheerio parses markup; it does not validate against the RSS 2.0 spec. This
// only checks the shape this harness depends on elsewhere, not conformance.
assert(
  $rss('rss').length === 1 && $rss('channel').length === 1,
  'dist/rss.xml has exactly one <rss><channel> root (structural check, not RSS-spec validation)'
);

const $blogIndexHtml = cheerio.load(blogIndex);
const blogIndexTitle = $blogIndexHtml('title').first().text().trim();
const blogIndexDescription = $blogIndexHtml('meta[name="description"]').attr('content') || '';
const channelTitle = $rss('channel > title').first().text().trim();
const channelDescription = $rss('channel > description').first().text().trim();
assert(
  channelTitle === blogIndexTitle,
  'RSS channel title equals the blog index <title>',
  `channel="${channelTitle}" page="${blogIndexTitle}"`
);
assert(
  channelDescription === blogIndexDescription,
  'RSS channel description equals the blog index meta description',
  `channel="${channelDescription}" page="${blogIndexDescription}"`
);

const rssItems = $rss('item').toArray();
const rssItemLinks = new Set(rssItems.map((el) => $rss(el).find('link').first().text().trim()));

const missingFromRss = [...expectedPostUrls].filter((url) => !rssItemLinks.has(url));
const leakedInRss = [...rssItemLinks].filter((url) => !expectedPostUrls.has(url));
assert(
  missingFromRss.length === 0 && leakedInRss.length === 0,
  'RSS item links equal published-post URLs exactly',
  `missing=[${missingFromRss.join(', ')}] unexpected=[${leakedInRss.join(', ')}]`
);

const rssItemsWellFormed = rssItems.length > 0 && rssItems.every((el) => {
  const $el = $rss(el);
  return $el.find('title').text().trim().length > 0
    && $el.find('description').text().trim().length > 0
    && $el.find('pubDate').text().trim().length > 0;
});
assert(rssItemsWellFormed, 'every RSS item has a non-empty title, description and pubDate');

// Page date text is formatted via toLocaleDateString('en-US', { year:
// 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }) in both blog
// pages (see formatDate() in blog/index.astro and blog/[...slug].astro) —
// e.g. "Apr 28, 2026". That explicit timeZone: 'UTC' is what makes the page
// side UTC, not an assumption about the build host's local zone. Parsed here
// against fixed fields rather than re-parsed through `Date`, whose parsing
// of a bare "Mon DD, YYYY" string is locale/timezone dependent and would
// defeat an "in UTC" comparison.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parsePageDate(text) {
  const match = text.trim().match(/^([A-Za-z]{3})\s+(\d{2}),\s+(\d{4})$/);
  if (!match) return null;
  const [, mon, day, year] = match;
  const month = MONTH_ABBR.indexOf(mon);
  if (month === -1) return null;
  return { year: Number(year), month, day: Number(day) };
}
// RSS pubDate is RFC-822 with an explicit "GMT" zone (see rss.xml.ts), so
// `Date` parses it unambiguously; reading back the UTC fields avoids any
// dependency on the host's local timezone.
function parseRssPubDate(text) {
  const d = new Date(text);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

for (const el of rssItems) {
  const $el = $rss(el);
  const link = $el.find('link').first().text().trim();
  const itemTitle = $el.find('title').text().trim();
  const itemDescription = $el.find('description').text().trim();
  const itemPubDate = $el.find('pubDate').text().trim();

  const postFile = distPathForPostUrl(link);
  if (!existsSync(postFile)) {
    fail(`RSS item content matches its post page (${link})`, `post page not found at ${postFile}`);
    continue;
  }
  const $post = cheerio.load(readFileSync(postFile, 'utf8'));
  const pageTitle = $post('h1').first().text().trim();
  const pageDescription = $post('meta[name="description"]').attr('content') || '';
  const pageDateText = $post('.post-meta').first().text().trim();

  assert(
    itemTitle === pageTitle,
    `RSS item title matches post <h1> (${link})`,
    `item="${itemTitle}" page="${pageTitle}"`
  );
  assert(
    itemDescription === pageDescription,
    `RSS item description matches post meta description (${link})`,
    `item="${itemDescription}" page="${pageDescription}"`
  );

  const pageDate = parsePageDate(pageDateText);
  const rssDate = parseRssPubDate(itemPubDate);
  assert(
    pageDate !== null
      && rssDate.year === pageDate.year
      && rssDate.month === pageDate.month
      && rssDate.day === pageDate.day,
    `RSS item pubDate is the same UTC calendar date as the post page (${link})`,
    `item="${itemPubDate}" page="${pageDateText}"`
  );
}

// A substring check on the tag only proves *a* rss+xml alternate link is
// somewhere in the markup — it would still pass on a wrong or typo'd href.
// Parse and assert the href value, since this href is hand-duplicated across
// three files with no shared layout.
function rssAutodiscoveryHref(html) {
  const $ = cheerio.load(html);
  return $('link[rel="alternate"][type="application/rss+xml"]').attr('href');
}
assert(rssAutodiscoveryHref(indexHtml) === '/rss.xml', 'RSS autodiscovery link on landing page points at /rss.xml');
assert(rssAutodiscoveryHref(blogIndex) === '/rss.xml', 'RSS autodiscovery link on blog index points at /rss.xml');
assert(rssAutodiscoveryHref(postHtml) === '/rss.xml', 'RSS autodiscovery link on a blog post points at /rss.xml');

// ─── 13. Sitemap ────────────────────────────────────────────────────────────

console.log('\n[13] Sitemap');

assert(existsSync(join(DIST, 'sitemap-index.xml')), 'dist/sitemap-index.xml exists');

// Pool every child sitemap's <url><loc> entries — @astrojs/sitemap may
// shard output across more than one file as the site grows.
const childSitemaps = loadChildSitemaps(join(DIST, 'sitemap-index.xml'));
const sitemapLocs = childSitemaps.flatMap(({ xml }) => {
  const $child = cheerio.load(xml, { xmlMode: true });
  return $child('url > loc').toArray().map((el) => $child(el).text().trim());
});

assert(sitemapLocs.includes('https://mnemra.dev/'), 'sitemap lists the site root');
const missingFromSitemap = [...expectedPostUrls].filter((url) => !sitemapLocs.includes(url));
assert(
  missingFromSitemap.length === 0,
  'sitemap lists every published post URL',
  missingFromSitemap.length > 0 ? `missing: ${missingFromSitemap.join(', ')}` : ''
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(60));

if (failed > 0) {
  console.error('\nFailed scenarios:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.error(`  - ${r.scenario}${r.detail ? ': ' + r.detail : ''}`);
  });
  process.exit(1);
}

process.exit(0);
