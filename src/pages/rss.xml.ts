import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Channel title/description mirror src/pages/blog/index.astro's <title> and
// meta description verbatim (not the landing page's — that copy carries a
// claim being corrected in a parallel change). Keep these in sync if that
// page's copy changes.
const CHANNEL_TITLE = 'Blog — Mnemra';
const CHANNEL_DESCRIPTION = 'Writing from Mnemra — a context layer for MCP.';

export const GET: APIRoute = async (context) => {
  if (!context.site) {
    throw new Error('astro.config.mjs must set `site` for RSS link generation');
  }

  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sorted = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: CHANNEL_TITLE,
    description: CHANNEL_DESCRIPTION,
    site: context.site,
    items: sorted.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary,
      // post.id matches the [...slug].astro route param exactly (both come
      // from the same content-collection id) — trailing slash to match the
      // real, built post URL (dist/blog/<slug>/index.html).
      link: `/blog/${post.id}/`,
    })),
  });
};
