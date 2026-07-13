/**
 * Public type surface.
 *
 * Everything `@astrolib/seo` accepted is accepted here, so an existing
 * `<AstroSeo {...props} />` keeps type-checking after the swap. Additions are
 * layered on top: camelCase aliases, shorthand forms, and JSON-LD.
 */

/** A URL that may be relative. Relative values are resolved against `site`. */
export type MaybeRelativeUrl = string | URL;

/* -------------------------------------------------------------------------- */
/* Open Graph                                                                  */
/* -------------------------------------------------------------------------- */

export interface OpenGraphMedia {
  url: string;
  /** Rendered as `og:image:secure_url` / `og:video:secure_url`. */
  secureUrl?: string;
  /** MIME type, e.g. `image/webp`. Inferred from the file extension when omitted. */
  type?: string;
  width?: number;
  height?: number;
  /** Strongly recommended for accessibility; surfaced by most social clients. */
  alt?: string;
}

/**
 * A bare URL string is accepted as shorthand for `{ url }` wherever this type
 * appears — i.e. on the top-level `image` prop.
 *
 * Note `OpenGraph.images` / `OpenGraph.videos` are deliberately NOT widened to
 * this: callers *read* those arrays as well as write them (travis.media's
 * `adaptOpenGraphImages` resizes each `image.url` before handing it back), and a
 * `string | OpenGraphMedia` union would break every such call site. Input sugar
 * is not worth breaking the shape people already destructure.
 */
export type OpenGraphMediaInput = string | OpenGraphMedia;

export interface OpenGraphProfile {
  firstName?: string;
  lastName?: string;
  username?: string;
  gender?: string;
}

export interface OpenGraphBook {
  authors?: ReadonlyArray<string>;
  isbn?: string;
  releaseDate?: string;
  tags?: ReadonlyArray<string>;
}

export interface OpenGraphArticle {
  /** ISO 8601 datetime. A `Date` is accepted and serialized for you. */
  publishedTime?: string | Date;
  modifiedTime?: string | Date;
  expirationTime?: string | Date;
  /** Author profile URLs, or plain names. */
  authors?: ReadonlyArray<string>;
  /** Publisher profile URL. Emits `article:publisher`. */
  publisher?: string;
  section?: string;
  tags?: ReadonlyArray<string>;
}

export interface OpenGraphVideoActor {
  profile: string;
  role?: string;
}

export interface OpenGraphVideo {
  actors?: ReadonlyArray<OpenGraphVideoActor>;
  directors?: ReadonlyArray<string>;
  writers?: ReadonlyArray<string>;
  duration?: number;
  releaseDate?: string;
  tags?: ReadonlyArray<string>;
  series?: string;
}

export interface OpenGraph {
  /** Canonical URL of this object. Relative values are resolved against `site`. */
  url?: MaybeRelativeUrl;
  /** e.g. `website`, `article`, `profile`. Defaults to `website` when any OG data is present. */
  type?: string;
  /** Falls back to the top-level `title` (after `titleTemplate` is applied). */
  title?: string;
  /** Falls back to the top-level `description`. */
  description?: string;
  images?: ReadonlyArray<OpenGraphMedia>;
  videos?: ReadonlyArray<OpenGraphMedia>;
  locale?: string;
  /**
   * Site name. `siteName` is the preferred spelling; `site_name` is accepted
   * for `@astrolib/seo` / `next-seo` compatibility. Both emit `og:site_name`.
   */
  siteName?: string;
  site_name?: string;
  profile?: OpenGraphProfile;
  book?: OpenGraphBook;
  article?: OpenGraphArticle;
  video?: OpenGraphVideo;
}

/* -------------------------------------------------------------------------- */
/* Twitter / X                                                                 */
/* -------------------------------------------------------------------------- */

export type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';

export interface Twitter {
  /**
   * Card type. `card` is the preferred spelling (it matches the tag it emits);
   * `cardType` is accepted for `@astrolib/seo` compatibility.
   */
  card?: TwitterCardType | (string & {});
  cardType?: TwitterCardType | (string & {});
  /** `@handle` of the site. Emits `twitter:site`. */
  site?: string;
  /**
   * `@handle` of the content author. Emits `twitter:creator`.
   * `creator` is the preferred spelling; `handle` is accepted for compatibility.
   */
  creator?: string;
  handle?: string;

  /**
   * The tags below are optional. X/Twitter falls back to the Open Graph tags
   * when they are absent, so they are only emitted when you set them
   * explicitly — no redundant duplication of `og:*` by default.
   */
  title?: string;
  description?: string;
  image?: MaybeRelativeUrl;
  imageAlt?: string;
}

/* -------------------------------------------------------------------------- */
/* Robots                                                                      */
/* -------------------------------------------------------------------------- */

export type ImagePrevSize = 'none' | 'standard' | 'large';

export interface AdditionalRobotsProps {
  nosnippet?: boolean;
  maxSnippet?: number;
  maxImagePreview?: ImagePrevSize;
  maxVideoPreview?: number;
  noarchive?: boolean;
  unavailableAfter?: string;
  noimageindex?: boolean;
  notranslate?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Alternates, extra tags                                                      */
/* -------------------------------------------------------------------------- */

export interface MobileAlternate {
  media: string;
  href: string;
}

export interface LanguageAlternate {
  hreflang: string;
  href: string;
}

export interface BaseMetaTag {
  content: string;
}

export interface HTML5MetaTag extends BaseMetaTag {
  name: string;
  property?: undefined;
  httpEquiv?: undefined;
}

export interface RDFaMetaTag extends BaseMetaTag {
  property: string;
  name?: undefined;
  httpEquiv?: undefined;
}

export interface HTTPEquivMetaTag extends BaseMetaTag {
  httpEquiv: 'content-security-policy' | 'content-type' | 'default-style' | 'x-ua-compatible' | 'refresh';
  name?: undefined;
  property?: undefined;
}

export type MetaTag = HTML5MetaTag | RDFaMetaTag | HTTPEquivMetaTag;

export interface LinkTag {
  rel: string;
  href: string;
  sizes?: string;
  media?: string;
  type?: string;
  color?: string;
  as?: string;
  crossOrigin?: string;
  hreflang?: string;
  title?: string;
  imagesrcset?: string;
  imagesizes?: string;
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                     */
/* -------------------------------------------------------------------------- */

/** A schema.org node. `@context` is injected when you omit it. */
export type JsonLdObject = Record<string, unknown>;

/** One node, or several. Several are emitted as separate script tags. */
export type JsonLdInput = JsonLdObject | ReadonlyArray<JsonLdObject>;

/* -------------------------------------------------------------------------- */
/* Component props                                                             */
/* -------------------------------------------------------------------------- */

export interface SEOProps {
  /** Page title. Combined with `titleTemplate` if that is set. */
  title?: string;
  /**
   * Template applied to `title`, where `%s` is the title.
   * e.g. `'%s | Travis Media'`. An empty string means "no template".
   */
  titleTemplate?: string;
  /** Used when `title` is not supplied. The template is not applied to it. */
  titleDefault?: string;

  description?: string;

  /**
   * Canonical URL. Relative values are resolved against `site`.
   * Pass `false` to suppress the tag entirely (e.g. on a paginated route you
   * deliberately do not want consolidated).
   */
  canonical?: MaybeRelativeUrl | false;

  /**
   * The page's share image — the shorthand for the 90% case.
   *
   * Sets `og:image` (with width/height/alt/type) and, when a Twitter card is
   * being emitted, `twitter:image`. `openGraph.images` still works and takes
   * precedence when both are given.
   */
  image?: OpenGraphMediaInput;

  /**
   * Article metadata, hoisted out of `openGraph` because it reads better at the
   * call site — and because supplying it implies `og:type="article"`.
   * Equivalent to `openGraph.article`, which also still works.
   */
  article?: OpenGraphArticle;

  /**
   * Base URL used to absolutize relative `canonical`, `og:url` and image URLs.
   * Defaults to `Astro.site` (from your `astro.config` `site` option).
   * Crawlers require absolute URLs for `og:image`.
   */
  site?: MaybeRelativeUrl;

  noindex?: boolean;
  nofollow?: boolean;
  robotsProps?: AdditionalRobotsProps;

  mobileAlternate?: MobileAlternate;
  languageAlternates?: ReadonlyArray<LanguageAlternate>;

  openGraph?: OpenGraph;
  /** Pass `false` to emit no `twitter:*` tags at all. */
  twitter?: Twitter | false;
  /**
   * Emits `fb:app_id`.
   * @deprecated Facebook stopped needing this when Domain Insights was retired
   * in 2016; the Sharing Debugger's "missing property" warning is stale. Kept
   * only so `@astrolib/seo` call sites keep working.
   */
  facebook?: { appId: string };

  /** Structured data, emitted as `<script type="application/ld+json">`. */
  jsonLd?: JsonLdInput;

  additionalMetaTags?: ReadonlyArray<MetaTag>;
  additionalLinkTags?: ReadonlyArray<LinkTag>;
}

/** `@astrolib/seo` compatibility alias. */
export type AstroSeoProps = SEOProps;

/* -------------------------------------------------------------------------- */
/* Internal tag model                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The builder emits this structured model rather than an HTML string; the
 * component renders it as real Astro elements. Escaping is therefore Astro's
 * job, not ours — there is no hand-rolled HTML concatenation anywhere.
 */
export type SeoTag =
  | { tag: 'title'; text: string }
  | { tag: 'meta'; attrs: Record<string, string> }
  | { tag: 'link'; attrs: Record<string, string> }
  | { tag: 'jsonld'; json: string };
