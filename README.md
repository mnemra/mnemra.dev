# mnemra.dev

Source for [mnemra.dev](https://mnemra.dev), the Mnemra landing page and blog. For Mnemra itself, see the [organization profile](https://github.com/mnemra) and [mnemra-core](https://github.com/mnemra/mnemra-core).

## Running locally

You need:

- Node.js 22. `.nvmrc` pins `22`, and `package.json` requires `>=22`.
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
| `just check` | Runs `astro check`, then builds the site and runs the checks in `tests/verify/run.mjs` against the output. Run it before you open a pull request. |

`just` with no arguments lists every recipe.

## Writing a post

Each post is one Markdown file in `src/content/blog/`, and the filename is the slug: `src/content/blog/hello-mnemra.md` is published at `/blog/hello-mnemra/`.

Frontmatter is validated when the site builds, so a missing required field or a value that breaks its rule fails the build.

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
| `hero` | No | Path to an image, relative to the post, rendered above the post as a `<picture>`. The build fails if the file doesn't exist. |
| `draft` | No | `true` or `false`. Defaults to `false`. |

Setting `draft: true` keeps a post off the site: it gets no page, and it's left out of the blog index, the RSS feed, and the sitemap.

Put a post's images in `src/content/blog/_assets/` and reference them with a relative path:

```md
![Alt text](./_assets/name.png)
```

Draw diagrams in [D2](https://d2lang.com) and commit the compiled SVG to `_assets/`. Image generators are for artwork such as a hero image, not for diagrams with labels. D2 isn't an npm dependency, so install it separately.

## Publishing

Merging to `main` publishes the site. Cloudflare Workers Builds builds each push to `main` and deploys it to mnemra.dev, and the result shows on the commit as the `Workers Builds: mnemradev` check.

A branch pushed to this repository also gets a Workers Build, and its check shows whether the site builds. The branch build doesn't publish a preview URL.

The repository has no CI workflows (there is no `.github/workflows/`), and no status check is required to merge. A passing branch build only means the site builds, so `just check` on your branch is the only thing that runs the type check and the `tests/verify/` checks before a change goes live.

## License

The site code, and anything else in this repository not listed below, is licensed under the Apache License, Version 2.0. The full text is in [LICENSE](LICENSE).

The following content is not covered by that license. It is © Peter Manahan, all rights reserved:

- the blog posts in `src/content/blog/`, including their images in `_assets/`
- the site's copy: the text of the pages in `src/pages/`
- the brand images `public/og.png` and `public/favicon.png`

Where a file in `src/pages/` holds both, its markup, styles, and scripts are code, and its text is copy.
