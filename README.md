# astro-seo-kit

Complete, type-safe SEO head tags for Astro: `<title>`, description, robots, canonical, Open Graph, Twitter/X cards, article metadata, and JSON-LD — from one component.

- **Astro 6 and 7.** `peerDependencies: astro ^6 || ^7`.
- **Zero runtime dependencies.** Astro is the only peer.
- **Absolute URLs, automatically.** Relative `canonical` and `og:image` values are resolved against your `site` — crawlers ignore relative ones.
- **Real elements, not stringified HTML.** Escaping is Astro's job, so a title with a quote in it cannot corrupt an attribute.
- **JSON-LD that can't break out of its `<script>`.**

## Set up once

**1. Install**, and set `site` in `astro.config.*` so relative URLs can be made absolute:

```sh
npm install astro-seo-kit
```

```js
export default defineConfig({ site: 'https://travis.media' });
```

**2. Put `<SEO />` in your layout's `<head>`** — the only place it ever goes. Site-wide defaults live here; each page's data spreads over them:

```astro
---
// src/layouts/Layout.astro
import { SEO } from 'astro-seo-kit';
import type { SEOProps } from 'astro-seo-kit';

type Props = { seo?: SEOProps };
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <SEO
      titleTemplate="%s | Travis Media"
      twitter={{ card: 'summary_large_image', site: '@travisdotmedia' }}
      {...Astro.props.seo}
    />
  </head>
  <body><slot /></body>
</html>
```

> Astro does **not** hoist `<meta>` out of nested components, so `<SEO />` must sit physically inside `<head>`. It deliberately does not emit `charset` or `viewport` — those belong to the layout, and a component that owns them tends to emit them in the wrong order.

**3. Feed it your content.** You never type a title into a head by hand — for a blog, one dynamic route reads every post's frontmatter:

```markdown
---
# src/content/blog/why-astro.md — an ordinary post
title: Why I switched to Astro
description: An honest look at the migration.
pubDate: 2026-07-13
tags: [astro]
ogImage: /og/why-astro.png
---
```

```astro
---
// src/pages/blog/[slug].astro — one file, every post
import { getCollection, render } from 'astro:content';
import Layout from '../../layouts/Layout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
<Layout seo={{
  title: post.data.title,
  description: post.data.description,
  canonical: `/blog/${post.id}/`,
  image: { url: post.data.ogImage, alt: post.data.title, width: 1200, height: 630 },
  article: { publishedTime: post.data.pubDate, authors: ['Travis Rodgers'], tags: post.data.tags },
  articleJsonLd: true,
}}>
  <Content />
</Layout>
```

Every post now renders its own complete `<head>`. For the post above — output copied from a real build:

```html
<title>Why I switched to Astro | Travis Media</title>
<meta name="description" content="An honest look at the migration.">
<link rel="canonical" href="https://travis.media/blog/why-astro/">
<meta property="og:title" content="Why I switched to Astro">
<meta property="og:description" content="An honest look at the migration.">
<meta property="og:url" content="https://travis.media/blog/why-astro/">
<meta property="og:type" content="article">
<meta property="og:image" content="https://travis.media/og/why-astro.png">
<meta property="og:image:alt" content="Why I switched to Astro">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="2026-07-13T00:00:00.000Z">
<meta property="article:author" content="Travis Rodgers">
<meta property="article:tag" content="astro">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@travisdotmedia">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","@id":"https://travis.media/blog/why-astro/#article","mainEntityOfPage":{"@type":"WebPage","@id":"https://travis.media/blog/why-astro/"},"headline":"Why I switched to Astro","description":"An honest look at the migration.","image":["https://travis.media/og/why-astro.png"],"datePublished":"2026-07-13T00:00:00.000Z","dateModified":"2026-07-13T00:00:00.000Z","author":{"@type":"Person","name":"Travis Rodgers"},"keywords":"astro"}</script>
```

Note what you did *not* have to do: no repeating the title inside an `openGraph.basic` object, no hand-writing `og:type`, no absolutizing the image yourself, no ISO-formatting the date, no JSON-LD written by hand. Publishing the next post touches no code at all — its frontmatter is its SEO.

## Props

### Core

| Prop | Type | Notes |
| --- | --- | --- |
| `title` | `string` | |
| `titleTemplate` | `string` | `%s` is replaced by `title`. `''` means "no template". |
| `titleDefault` | `string` | Used when `title` is absent. The template is **not** applied to it. |
| `description` | `string` | |
| `canonical` | `string \| URL \| false` | Relative values resolved against `site`. `false` omits the tag. |
| `site` | `string \| URL` | Defaults to `Astro.site`. |
| `image` | `string \| OpenGraphMedia` | Shorthand for `openGraph.images[0]`. A bare URL string works. |
| `article` | `OpenGraphArticle` | Implies `og:type="article"`. |
| `articleJsonLd` | `boolean \| object` | Derives an Article JSON-LD node from the props above. See [Article structured data, derived](#article-structured-data-derived). |

### Robots

`noindex` and `nofollow` are booleans. They are only emitted when set, so leaving them out emits no `robots` tag at all rather than guessing.

```astro
<SEO noindex nofollow robotsProps={{ maxImagePreview: 'large', maxSnippet: 160 }} />
<!-- <meta name="robots" content="noindex,nofollow,max-snippet:160,max-image-preview:large"> -->
```

`robotsProps` accepts `nosnippet`, `maxSnippet`, `maxImagePreview`, `maxVideoPreview`, `noarchive`, `unavailableAfter`, `noimageindex`, `notranslate`.

> Consider `maxImagePreview: 'large'` — it unlocks large image thumbnails in Google. It is **not** on by default, because silently changing the robots directives of every page in an existing site is not a default's job to do.

### Open Graph

```astro
<SEO
  openGraph={{
    type: 'article',
    siteName: 'Travis Media',
    locale: 'en',
    images: [{ url: '/og.png', alt: 'Cover', width: 1200, height: 630 }],
    article: { publishedTime: '2026-07-13', section: 'Development', tags: ['astro'] },
  }}
/>
```

- `og:title` / `og:description` fall back to the top-level `title` / `description`. `og:title` uses the **raw** title, not the templated one — the `| Site Name` suffix is chrome for a browser tab, not for a shared card.
- `og:url` falls back to the resolved `canonical` — [ogp.me](https://ogp.me) lists it among the four required properties, and for almost every page the two are the same URL. `canonical={false}` suppresses the fallback too.
- `og:type` defaults to `website`, or to the object type whose metadata is present: `article`, `profile` or `book`. Video metadata implies no default — `video.movie` vs `video.episode` is not ours to guess.
- `og:image:type` is inferred from the file extension when you don't supply it.
- `siteName` and `site_name` both work.
- Empty image URLs are skipped rather than emitted as `content=""`.

### Twitter / X

```astro
<SEO twitter={{ card: 'summary_large_image', site: '@travisdotmedia', creator: '@travisdotmedia' }} />
```

`card`/`cardType` and `creator`/`handle` are interchangeable spellings.

X falls back to the `og:*` tags for title, description and image, so **`twitter:title`, `twitter:description` and `twitter:image` are not emitted unless you set them explicitly.** Mirroring `og:*` into every page's head by default is dead weight. Set them when the card should differ from the OG card. `twitter={false}` emits nothing at all.

### JSON-LD

```astro
<SEO jsonLd={{ '@type': 'BlogPosting', headline: 'Why I switched to Astro', author: { '@type': 'Person', name: 'Travis Rodgers' } }} />
```

`@context` is injected when you omit it. Pass an array to emit several nodes. There is also a standalone component, for structured data that belongs next to the thing it describes:

```astro
---
import { JsonLd } from 'astro-seo-kit';
---
<JsonLd schema={{ '@type': 'Product', name: 'Course' }} />
```

**On safety:** the contents of a `<script>` are raw text, so Astro cannot escape them for you. A bare `set:html={JSON.stringify(schema)}` lets a `</script>` sequence inside any string field close the element early and start parsing markup, because `JSON.stringify` does not escape `<`.

This package escapes `<`, `>` and the U+2028/U+2029 line terminators as **JSON unicode escapes** (`\u003c`). That prevents the breakout *and* leaves the decoded data byte-for-byte identical, since `JSON.parse` turns `\u003c` straight back into `<`.

The other way to close the hole is to HTML-entity-escape the string values, which is what [`astro-seo-schema`](https://github.com/codiume/orbit/tree/main/packages/astro-seo-schema) does via Google's `safeJsonLdReplacer`. That is genuinely breakout-safe — but it mutates your data. A `<script>` is a raw text element, so entity references inside it are never decoded: a consumer parsing that JSON sees a literal `&lt;/script&gt;`, and an ordinary ampersand in a headline ("Tom & Jerry") arrives as `Tom &amp; Jerry`. Unicode escapes avoid that corruption.

### Article structured data, derived

The component already holds everything an [Article](https://developers.google.com/search/docs/appearance/structured-data/article) node needs — so it can build one:

```astro
<SEO
  title="Why I switched to Astro"
  description="An honest look at the migration."
  canonical="/blog/why-astro/"
  image={{ url: '/og/why-astro.png', alt: 'Cover' }}
  article={{ publishedTime: post.date, authors: ['Travis Rodgers'] }}
  openGraph={{ siteName: 'Travis Media' }}
  articleJsonLd
/>
```

That emits a JSON-LD node with `headline` (the raw title), `description`, `image` (absolutized), `datePublished`/`dateModified` (the latter falls back to the former — AI retrieval and Google both read it), `author` Person nodes (profile URLs become `{ url }`, names become `{ name }`), `publisher` from `siteName`, `articleSection`, `keywords`, and `@id`/`mainEntityOfPage` from the canonical.

The rules that keep it safe:

- **Opt-in and derivable-only.** Without `article` metadata and a title, nothing is emitted (and dev mode warns).
- **Your data wins.** If `jsonLd` already contains an `*Article`/`*Posting` node, derivation is skipped.
- **Every field is correctable.** Pass an object instead of `true` and it merges over the derived node last: `articleJsonLd={{ '@type': 'BlogPosting', publisher: { '@type': 'Organization', name: 'TM', logo: '…' } }}`.
- `@type` defaults to `Article` — valid for every article-shaped page; blogs override with one word.
- `article.publisher` is **not** used as the schema publisher: that OG field is a Facebook profile URL, the wrong shape for an Organization.

The builder is also exported as a pure function for composing by hand: `articleJsonLd(props, overrides?)`.

### Typed schema (optional)

The `jsonLd` prop is deliberately untyped — but if you want the schema.org vocabulary checked at compile time, install [`schema-dts`](https://github.com/google/schema-dts) (types-only, so runtime dependencies stay at zero) and import from the `/schema` subpath:

```sh
npm install -D schema-dts
```

```astro
---
import { SEO } from 'astro-seo-kit';
import { defineSchema } from 'astro-seo-kit/schema';
---
<SEO jsonLd={defineSchema({ '@type': 'BlogPosting', headline: 'Typed' })} />
```

A typo'd `@type` or property name is now a compile error instead of a node search engines silently ignore. The subpath is the only file that references `schema-dts`, and the package ships as source — so if you never import it, the dependency is never required.

### Escape hatches

```astro
<SEO
  additionalMetaTags={[{ name: 'theme-color', content: '#0f172a' }]}
  additionalLinkTags={[{ rel: 'preload', href: '/font.woff2', as: 'font', crossOrigin: 'anonymous' }]}
/>
```

There is no `keywords` prop. Google is explicit that it ignores the keywords meta tag entirely; if you need it for some other consumer, use `additionalMetaTags`. `facebook={{ appId }}` still exists for compatibility but is deprecated — `fb:app_id` stopped doing anything useful when Facebook retired Domain Insights.

## Dev-time warnings

In `astro dev` only, the component warns about the mistakes you otherwise discover weeks later in a bad Slack unfurl: a missing title, description or canonical; an `og:image` with no `alt`; and a relative URL it could not absolutize because `site` is unset. These never affect output and are stripped from production builds.

## Migrating from `@astrolib/seo`

`@astrolib/seo` is unmaintained: still `1.0.0-beta.8` from October 2024, peer-capped at Astro 5 (so Astro 6/7 users need an `overrides` pin), and carrying open bugs. This package is a drop-in replacement — the import path is the only required change:

```diff
-import { AstroSeo } from '@astrolib/seo';
-import type { Props as AstroSeoProps } from '@astrolib/seo';
+import { SEO } from 'astro-seo-kit';
+import type { SEOProps } from 'astro-seo-kit';
```

`AstroSeo` is also exported as an alias, so `import { AstroSeo } from 'astro-seo-kit'` works unchanged. Every prop is supported with the same shape and the same tag order.

It was verified against a real 462-page Astro 7 site (travis.media): after the swap, **all 462 pages produced a semantically identical `<head>`**, with only the intentional additions listed under [What changes](#what-changes-vs-astrolibseo) (on that site, just `og:image:type` — the `og:url` fallback never fires when `openGraph.url` is passed explicitly).

### What changes vs `@astrolib/seo`

Bugs fixed:

- **`article:*`, `book:*`, `profile:*` and `video:*` were emitted with a bogus `og:` prefix** — `og:article:published_time` instead of `article:published_time`. Per [ogp.me](https://ogp.me) these are separate namespaces, and no consumer recognizes the prefixed form, so article metadata was silently doing nothing.
- **`robotsProps.maxVideoPreview` was typed but never emitted.**
- **An unresolvable image emitted `<meta property="og:image" content="">`** — an empty card image, which is worse than no image.
- **A stray blank line** was emitted after every OG image block.

Added: `og:image:type` inference, `og:url` falling back to the canonical, `og:type` defaulting, `article:publisher`, JSON-LD (with derived Article nodes and optional `schema-dts` typing), `titleDefault`, `canonical={false}`, `twitter={false}`, relative-URL resolution, camelCase aliases (`siteName`, `card`, `creator`), `Date` support on article timestamps, and dev-time warnings.

One behavior difference worth knowing: attribute values are escaped by Astro rather than by `html-escaper`, so `'`, `<` and `>` appear literally inside double-quoted attributes instead of as `&#39;`/`&lt;`/`&gt;`. This is valid HTML5 — those characters have no special meaning inside a double-quoted attribute value — and both forms decode to exactly the same string. The characters that *could* break an attribute, `"` and `&`, are escaped.

## Migrating from `astro-seo`

`astro-seo` is the popular one, and it is fine. Reasons you might move:

- It ships **`@astrojs/check` as a runtime dependency**, dragging TypeScript and the Astro language server into your production `node_modules` ([#112](https://github.com/jonasmerlin/astro-seo/issues/112)). This package has zero runtime dependencies.
- It declares **no `peerDependencies` at all**, so nothing tells you whether it supports your Astro version.
- **No JSON-LD**, by design.
- `openGraph.basic` **makes you restate** the title and image you already passed at the top level.
- **Canonical cannot be omitted** ([#107](https://github.com/jonasmerlin/astro-seo/issues/107)).

Prop mapping:

| `astro-seo` | here |
| --- | --- |
| `openGraph.basic.{title,type,image,url}` | inferred from `title` / `image` / `canonical`; override via `openGraph` |
| `openGraph.image.{alt,width,height}` | `image.{alt,width,height}` |
| `openGraph.article` | `article` |
| `extend.meta` / `extend.link` | `additionalMetaTags` / `additionalLinkTags` |
| `robotsExtras` | `robotsProps` |
| *(none)* | `jsonLd` |

## Testing

```sh
npm test
```

88 tests via [Astro's Container API](https://docs.astro.build/en/reference/container-reference/) under vitest — asserting on real rendered HTML, not on a string built by the test itself. Coverage: title templating, robots serialization, canonical resolution, `og:url` fallback, OG media, article metadata, Twitter aliases, derived Article JSON-LD, dev-time warnings, escaping, `<script>` breakout resistance, and a golden test pinning the exact tag sequence `@astrolib/seo` produced.

## License

MIT © Travis Rodgers
