# mnemra.dev

Source for [mnemra.dev](https://mnemra.dev), the Mnemra landing page and blog. For Mnemra itself, see the [organization profile](https://github.com/mnemra) and [mnemra-core](https://github.com/mnemra/mnemra-core).

## Running locally

You need:

- Node.js 22 or later (`.nvmrc` pins 22)
- npm
- [just](https://github.com/casey/just)

Install dependencies from the lockfile, then start the dev server:

```sh
npm ci
just dev
```

| Recipe | What it does |
| --- | --- |
| `just dev` | Starts the Astro dev server. |
| `just build` | Builds the static site into `dist/`. The build fails if any post's frontmatter is invalid. |
| `just check` | Runs `astro check`, then builds the site and runs the tests in `tests/verify/run.mjs` against the output. Run it before you open a pull request. |

`just` with no arguments lists every recipe.

## Writing a post

Each post is one Markdown file in `src/content/blog/`, and the slug is the filename, lowercased: `src/content/blog/hello-mnemra.md` is published at `/blog/hello-mnemra/`.

Frontmatter is validated when the site builds, so a missing required field or a value that breaks its rule fails the build. The build doesn't reject keys it doesn't know, though, so a misspelled key is silently ignored: a post with `Draft: true` instead of `draft: true` builds and is published.

```yaml
---
title: "Hello, Mnemra"
date: 2026-04-28
summary: "One or two sentences, up to 280 characters."
tags: ["mnemra", "mcp"]
hero: ./_assets/hello-hero.png
draft: false
---
```

| Field | Required | Rule |
| --- | --- | --- |
| `title` | Yes | Non-empty string. |
| `date` | Yes | A date, such as `2026-04-28`. |
| `summary` | Yes | 1 to 280 characters. Used in the blog index, the RSS feed, and the post's description meta tags. |
| `tags` | No | List of strings. Defaults to none. |
| `hero` | No | Path to an image, relative to the post, rendered as a `<picture>` below the title, date, and tags. The build fails if the file doesn't exist. |
| `draft` | No | `true` or `false`. Defaults to `false`. |

Setting `draft: true` keeps a post off the site: it gets no page, and it's left out of the blog index, the RSS feed, and the sitemap. This repository is public, so a draft is still readable on GitHub as soon as you push it.

Put a post's images in `src/content/blog/_assets/` and reference them with a relative path:

```md
![Alt text](./_assets/name.png)
```

Draw diagrams in [D2](https://d2lang.com) so they stay exact and versionable, and commit the compiled SVG to `_assets/`. D2 isn't an npm dependency and nothing in this repository runs it, so install it and compile the diagram yourself. Image generators are for artwork such as a hero image, not for diagrams with labels.

## Publishing

Merging to `main` publishes the site. Only pushes to `main` are built: Cloudflare deploys each one to mnemra.dev, and the result shows on the commit as the `Workers Builds: mnemradev` check. A branch pushed to this repository gets no Cloudflare build and no preview.

No status check is required to merge, and the repository has no CI workflows of its own, so `just check` on your branch is the only thing that runs `astro check` and the tests in `tests/verify/` before you merge.

## License

The site code, and anything else in this repository not listed below, is licensed under the Apache License, Version 2.0. The full text is in [LICENSE](LICENSE).

The following content is not covered by that license. It is © Peter Manahan, all rights reserved:

- the blog posts in `src/content/blog/`, including everything in `_assets/`
- the site's copy: the text the site shows readers, wherever it sits, including verbatim copies of it such as the assertions in `tests/verify/run.mjs`
- the brand images `public/og.png` and `public/favicon.png`

Where a file in `src/pages/` holds both, its markup, styles, and scripts are code, and its text is copy. Text counts as copy even when it sits in a script or an attribute, such as a string in a page's frontmatter script, a meta description, or the RSS feed's title and description.
