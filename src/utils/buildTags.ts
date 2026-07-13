import type { OpenGraphMedia, OpenGraphMediaInput, SeoTag, SEOProps } from '../types';
import { inferMimeType, resolveUrl, toIsoString } from './url';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** `images: ['/og.png']` is sugar for `images: [{ url: '/og.png' }]`. */
const normalizeMedia = (input: OpenGraphMediaInput): OpenGraphMedia =>
  typeof input === 'string' ? { url: input } : input;

/**
 * Build the ordered tag model for a set of SEO props.
 *
 * Tag order matches `@astrolib/seo` exactly so that swapping the component in
 * an existing site produces the same `<head>`, in the same sequence, byte for
 * byte. Deviations from the incumbent are deliberate and marked FIX/NEW.
 */
export const buildTags = (config: SEOProps): SeoTag[] => {
  const tags: SeoTag[] = [];
  const site = config.site;

  const meta = (attrs: Record<string, string | undefined>) => {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (!isPresent(value)) return; // never emit a tag with an empty value
      clean[key] = value;
    }
    tags.push({ tag: 'meta', attrs: clean });
  };

  const link = (attrs: Record<string, string | undefined>) => {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== '') clean[key] = value;
    }
    if (!isPresent(clean.href)) return;
    tags.push({ tag: 'link', attrs: clean });
  };

  /** An `og:`-prefixed property: `og:title`, `og:image:width`, ... */
  const og = (property: string, content: string | undefined) =>
    meta({ property: `og:${property}`, content });

  /**
   * A property in one of Open Graph's *object-type* vocabularies.
   *
   * FIX: per ogp.me these live in their own namespaces — `article:published_time`,
   * `book:isbn`, `profile:first_name`, `video:actor` — and are NOT `og:`-prefixed.
   * `@astrolib/seo` prefixes them anyway, emitting `og:article:published_time`
   * and friends, which no consumer recognizes (astrolib#25). We emit them plain.
   *
   * Note this is distinct from the *media* properties `og:video:width` etc.,
   * which are structured properties of `og:video` and stay prefixed.
   */
  const objectProperty = (property: string, content: string | undefined) =>
    meta({ property, content });

  /* --- Title ------------------------------------------------------------- */
  // NEW: `titleDefault` covers pages that supply no title of their own. It is a
  // complete title in its own right, so the template does not decorate it —
  // otherwise a site named "Travis Media" renders "Travis Media | Travis Media".
  const rawTitle = isPresent(config.title) ? config.title : config.titleDefault;
  if (isPresent(rawTitle)) {
    // An empty `titleTemplate` means "no template" — matching the incumbent,
    // and relied on by sites that set `template: ''` in config.
    const text =
      isPresent(config.title) && isPresent(config.titleTemplate)
        ? config.titleTemplate.replace('%s', config.title)
        : rawTitle;
    tags.push({ tag: 'title', text });
  }

  /* --- Description ------------------------------------------------------- */
  meta({ name: 'description', content: config.description });

  /* --- Robots ------------------------------------------------------------ */
  const robots: string[] = [];
  if (typeof config.noindex !== 'undefined') robots.push(config.noindex ? 'noindex' : 'index');
  if (typeof config.nofollow !== 'undefined') robots.push(config.nofollow ? 'nofollow' : 'follow');

  if (config.robotsProps) {
    const {
      nosnippet,
      maxSnippet,
      maxImagePreview,
      maxVideoPreview,
      noarchive,
      unavailableAfter,
      noimageindex,
      notranslate,
    } = config.robotsProps;

    if (nosnippet) robots.push('nosnippet');
    if (typeof maxSnippet === 'number') robots.push(`max-snippet:${maxSnippet}`);
    if (maxImagePreview) robots.push(`max-image-preview:${maxImagePreview}`);
    // FIX: the incumbent types `maxVideoPreview` but never emits it.
    if (typeof maxVideoPreview === 'number') robots.push(`max-video-preview:${maxVideoPreview}`);
    if (noarchive) robots.push('noarchive');
    if (unavailableAfter) robots.push(`unavailable_after:${unavailableAfter}`);
    if (noimageindex) robots.push('noimageindex');
    if (notranslate) robots.push('notranslate');
  }

  if (robots.length > 0) meta({ name: 'robots', content: robots.join(',') });

  /* --- Canonical --------------------------------------------------------- */
  // NEW: `canonical={false}` suppresses the tag; `undefined` merely means "none given".
  if (config.canonical !== false) {
    link({ rel: 'canonical', href: resolveUrl(config.canonical, site) });
  }

  /* --- Alternates -------------------------------------------------------- */
  if (config.mobileAlternate) {
    link({
      rel: 'alternate',
      media: config.mobileAlternate.media,
      href: resolveUrl(config.mobileAlternate.href, site),
    });
  }

  for (const alternate of config.languageAlternates ?? []) {
    link({
      rel: 'alternate',
      hreflang: alternate.hreflang,
      href: resolveUrl(alternate.href, site),
    });
  }

  /* --- Open Graph -------------------------------------------------------- */
  // NEW: the top-level `image` / `article` shorthands are equivalent to their
  // nested counterparts, so either alone is enough to produce an OG card.
  const article = config.article ?? config.openGraph?.article;
  const images = config.openGraph?.images ?? (config.image ? [config.image] : undefined);
  const openGraph = config.openGraph ?? (config.image || article ? {} : undefined);

  if (openGraph) {
    // Note: OG title falls back to the *raw* title, not the templated one — the
    // template is chrome for the browser tab, not for a shared card.
    og('title', isPresent(openGraph.title) ? openGraph.title : rawTitle);
    og('description', isPresent(openGraph.description) ? openGraph.description : config.description);
    og('url', resolveUrl(openGraph.url, site));

    // NEW: default to `website`, or to `article` when article metadata is
    // present. An OG card with no `og:type` is invalid, and omitting it is the
    // single most common mistake in hand-rolled head tags.
    const type = isPresent(openGraph.type) ? openGraph.type : article ? 'article' : 'website';
    og('type', type);

    const mediaTags = (kind: 'image' | 'video', media: ReadonlyArray<OpenGraphMediaInput>) => {
      for (const item of media.map(normalizeMedia)) {
        const url = resolveUrl(item.url, site);
        // FIX: the incumbent emits `<meta property="og:image" content="">` when
        // a URL fails to resolve. An empty card image is worse than none.
        if (!url) continue;

        og(kind, url);
        if (item.alt) og(`${kind}:alt`, item.alt);
        if (item.secureUrl) og(`${kind}:secure_url`, resolveUrl(item.secureUrl, site));
        // NEW: infer the MIME type from the extension when not given.
        const type = item.type ?? inferMimeType(url);
        if (type) og(`${kind}:type`, type);
        if (item.width) og(`${kind}:width`, String(item.width));
        if (item.height) og(`${kind}:height`, String(item.height));
      }
    };

    if (images?.length) mediaTags('image', images);
    if (openGraph.videos?.length) mediaTags('video', openGraph.videos);

    og('locale', openGraph.locale);
    og('site_name', openGraph.siteName ?? openGraph.site_name);

    const { profile, book, video } = openGraph;

    if (profile) {
      objectProperty('profile:first_name', profile.firstName);
      objectProperty('profile:last_name', profile.lastName);
      objectProperty('profile:username', profile.username);
      objectProperty('profile:gender', profile.gender);
    }

    if (book) {
      for (const author of book.authors ?? []) objectProperty('book:author', author);
      objectProperty('book:isbn', book.isbn);
      objectProperty('book:release_date', book.releaseDate);
      for (const tag of book.tags ?? []) objectProperty('book:tag', tag);
    }

    if (article) {
      objectProperty('article:published_time', toIsoString(article.publishedTime));
      objectProperty('article:modified_time', toIsoString(article.modifiedTime));
      objectProperty('article:expiration_time', toIsoString(article.expirationTime));
      for (const author of article.authors ?? []) objectProperty('article:author', author);
      // NEW: `article:publisher` — neither incumbent emits it.
      objectProperty('article:publisher', article.publisher);
      objectProperty('article:section', article.section);
      for (const tag of article.tags ?? []) objectProperty('article:tag', tag);
    }

    if (video) {
      for (const actor of video.actors ?? []) {
        objectProperty('video:actor', actor.profile);
        objectProperty('video:actor:role', actor.role);
      }
      for (const director of video.directors ?? []) objectProperty('video:director', director);
      for (const writer of video.writers ?? []) objectProperty('video:writer', writer);
      if (typeof video.duration === 'number') objectProperty('video:duration', String(video.duration));
      objectProperty('video:release_date', video.releaseDate);
      for (const tag of video.tags ?? []) objectProperty('video:tag', tag);
      objectProperty('video:series', video.series);
    }
  }

  /* --- Facebook ---------------------------------------------------------- */
  meta({ property: 'fb:app_id', content: config.facebook?.appId });

  /* --- Twitter / X ------------------------------------------------------- */
  const twitter = config.twitter;
  if (twitter) {
    meta({ name: 'twitter:card', content: twitter.card ?? twitter.cardType });
    meta({ name: 'twitter:site', content: twitter.site });
    meta({ name: 'twitter:creator', content: twitter.creator ?? twitter.handle });

    // Emitted only when set explicitly: X falls back to the `og:*` tags, so
    // mirroring them by default would just be dead weight in every page's head.
    meta({ name: 'twitter:title', content: twitter.title });
    meta({ name: 'twitter:description', content: twitter.description });
    meta({ name: 'twitter:image', content: resolveUrl(twitter.image, site) });
    meta({ name: 'twitter:image:alt', content: twitter.imageAlt });
  }

  /* --- Escape hatches ---------------------------------------------------- */
  for (const tag of config.additionalMetaTags ?? []) {
    if (isPresent(tag.name)) meta({ name: tag.name, content: tag.content });
    else if (isPresent(tag.property)) meta({ property: tag.property, content: tag.content });
    else if (isPresent(tag.httpEquiv)) meta({ 'http-equiv': tag.httpEquiv, content: tag.content });
  }

  for (const tag of config.additionalLinkTags ?? []) {
    link({
      rel: tag.rel,
      href: resolveUrl(tag.href, site),
      sizes: tag.sizes,
      media: tag.media,
      type: tag.type,
      color: tag.color,
      as: tag.as,
      crossorigin: tag.crossOrigin,
      hreflang: tag.hreflang,
      title: tag.title,
      imagesrcset: tag.imagesrcset,
      imagesizes: tag.imagesizes,
    });
  }

  /* --- JSON-LD ----------------------------------------------------------- */
  for (const node of normalizeJsonLd(config.jsonLd)) {
    tags.push({ tag: 'jsonld', json: node });
  }

  return tags;
};

/**
 * Serialize structured data, injecting `@context` when absent.
 *
 * The contents of a `<script>` are raw text, so this is the one place Astro
 * cannot escape for us. A `</script>` sequence inside any string — a post title,
 * a comment, anything author-supplied — would otherwise close the element early
 * and let the remainder parse as markup. A bare `set:html={JSON.stringify(x)}`
 * has exactly that hole, because JSON.stringify does not escape `<`.
 *
 * We escape `<` and `>` as JSON unicode escapes. That closes the hole *and*
 * leaves the decoded value byte-for-byte identical, because `\u003c` is a JSON
 * escape that `JSON.parse` turns back into `<`.
 *
 * The alternative fix — HTML-entity-escaping string values, as `astro-seo-schema`
 * does via its `safeJsonLdReplacer` — is also breakout-safe, but it mutates the
 * data: a `<script>` is a raw text element, so entity references inside it are
 * never decoded. A consumer parsing that JSON sees the literal `&lt;/script&gt;`,
 * and an ordinary ampersand in a headline ("Tom & Jerry") arrives as
 * "Tom &amp; Jerry". Unicode escapes avoid the corruption entirely.
 *
 * U+2028/U+2029 are escaped too: they are legal in JSON but are line terminators
 * to a JS parser, which trips up anything that re-parses the block as JS.
 */
export const normalizeJsonLd = (input: SEOProps['jsonLd']): string[] => {
  if (!input) return [];
  const nodes = Array.isArray(input) ? input : [input];

  return nodes
    .filter((node) => node && typeof node === 'object' && Object.keys(node).length > 0)
    .map((node) => {
      const withContext = '@context' in node ? node : { '@context': 'https://schema.org', ...node };
      return JSON.stringify(withContext)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    });
};
