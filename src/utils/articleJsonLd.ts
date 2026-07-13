import type { JsonLdObject, SEOProps } from '../types';
import { resolveUrl, toIsoString } from './url';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * OG article authors are either profile URLs or plain names; schema.org wants
 * Person nodes. A URL becomes `{ url }`, anything else `{ name }`.
 */
const person = (author: string): JsonLdObject =>
  /^https?:\/\//i.test(author.trim())
    ? { '@type': 'Person', url: author.trim() }
    : { '@type': 'Person', name: author.trim() };

/**
 * True when user-supplied JSON-LD already models the article — any node whose
 * `@type` ends in `Article` or `Posting` (Article, BlogPosting, NewsArticle,
 * TechArticle, SocialMediaPosting, ...). Derivation defers to it.
 */
export const hasArticleNode = (input: SEOProps['jsonLd']): boolean => {
  if (!input) return false;
  const nodes = Array.isArray(input) ? input : [input];

  return nodes.some((node) => {
    const type = (node as Record<string, unknown>)?.['@type'];
    const types = Array.isArray(type) ? type : [type];
    return types.some((entry) => typeof entry === 'string' && /(Article|Posting)$/.test(entry));
  });
};

/**
 * Build an Article node from the SEO props the component already receives.
 *
 * Derivation choices, and why:
 * - `@type` defaults to `Article` — the superclass is valid for every
 *   article-shaped page, and Google treats Article/BlogPosting/NewsArticle
 *   equivalently for rich results. Blogs override with one word.
 * - `headline` is the *raw* title: the `| Site Name` template suffix is
 *   browser-tab chrome, not the work's name.
 * - `publisher` comes from `openGraph.siteName`, NOT `article.publisher` —
 *   the OG field is a Facebook profile URL, which is the wrong shape for a
 *   schema.org Organization.
 * - `dateModified` falls back to `datePublished`: Google reads dateModified,
 *   and an article never modified was last modified when it was published.
 *
 * Returns `undefined` (rather than a half-empty node) without `article`
 * metadata and a title — dev mode warns when that happens.
 */
// Returns the concrete record shape (not the `JsonLdObject` union) so callers
// can read derived fields without a cast.
export const articleJsonLd = (
  props: SEOProps,
  overrides?: JsonLdObject
): Record<string, unknown> | undefined => {
  const site = props.site;
  const article = props.article ?? props.openGraph?.article;
  const rawTitle = isPresent(props.title) ? props.title : props.titleDefault;

  if (!article || !isPresent(rawTitle)) return undefined;

  const canonical = props.canonical === false ? undefined : resolveUrl(props.canonical, site);

  const images = (props.openGraph?.images ?? (props.image ? [props.image] : []))
    .map((image) => resolveUrl(typeof image === 'string' ? image : image.url, site))
    .filter(isPresent);

  const authors = (article.authors ?? []).filter(isPresent).map(person);
  const siteName = props.openGraph?.siteName ?? props.openGraph?.site_name;
  const published = toIsoString(article.publishedTime);
  const modified = toIsoString(article.modifiedTime) ?? published;

  return {
    '@type': 'Article',
    ...(canonical && {
      '@id': `${canonical}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    }),
    headline: rawTitle,
    ...(isPresent(props.description) && { description: props.description }),
    ...(images.length > 0 && { image: images }),
    ...(published && { datePublished: published }),
    ...(modified && { dateModified: modified }),
    ...(authors.length > 0 && { author: authors.length === 1 ? authors[0] : authors }),
    ...(isPresent(siteName) && { publisher: { '@type': 'Organization', name: siteName } }),
    ...(isPresent(article.section) && { articleSection: article.section }),
    ...(article.tags && article.tags.length > 0 && { keywords: article.tags.join(', ') }),
    ...overrides,
  };
};
