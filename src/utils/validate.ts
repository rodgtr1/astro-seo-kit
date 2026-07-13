import type { MaybeRelativeUrl, OpenGraphMediaInput, SEOProps } from '../types';
import { hasArticleNode } from './articleJsonLd';

/** Google truncates displayed headlines around this length. */
const HEADLINE_LIMIT = 110;

const isRelative = (url: unknown): boolean =>
  typeof url === 'string' && url.trim() !== '' && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());

/** Present the way `buildTags` means it: a non-blank string. */
const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const mediaUrl = (media: OpenGraphMediaInput | undefined): string | undefined =>
  typeof media === 'string' ? media : media?.url;

/**
 * Dev-only diagnostics.
 *
 * These are the mistakes that silently degrade a page's cards and snippets:
 * you only find out when a link looks wrong in a Slack unfurl weeks later.
 * They never affect the rendered output, and are stripped from production
 * builds along with the `import.meta.env.DEV` branch that calls them.
 */
export const warnAboutProps = (
  props: SEOProps,
  site: MaybeRelativeUrl | undefined,
  pathname = ''
): string[] => {
  const warnings: string[] = [];
  const where = pathname ? ` (${pathname})` : '';

  if (!isPresent(props.title) && !isPresent(props.titleDefault)) {
    warnings.push('no `title` — the page will have no <title> tag');
  }

  if (!isPresent(props.description)) {
    warnings.push('no `description` — search engines will synthesize a snippet from the page body');
  }

  // `canonical={false}` is a deliberate opt-out, not a mistake.
  if (props.canonical !== false && !props.canonical) {
    warnings.push('no `canonical` — duplicate-content risk if this page is reachable at more than one URL');
  }

  // The top-level `image` shorthand is checked alongside `openGraph.images` —
  // it is the promoted 90% path, so it gets the same scrutiny.
  const images: ReadonlyArray<OpenGraphMediaInput> = [
    ...(props.image ? [props.image] : []),
    ...(props.openGraph?.images ?? []),
  ];

  if (!site) {
    const twitterImage = props.twitter ? props.twitter.image : undefined;
    const relative = [
      props.canonical,
      props.openGraph?.url,
      twitterImage,
      ...images.map(mediaUrl),
    ].filter(isRelative);

    if (relative.length > 0) {
      warnings.push(
        `relative URL(s) [${relative.join(', ')}] could not be made absolute: set \`site\` in astro.config, ` +
          'or pass `site` to <SEO />. Crawlers ignore relative og:image and og:url.'
      );
    }
  }

  for (const image of images) {
    if (typeof image !== 'string' && isPresent(image?.url) && !isPresent(image.alt)) {
      warnings.push(`og:image "${image.url}" has no \`alt\``);
    }
  }

  if (props.articleJsonLd) {
    const article = props.article ?? props.openGraph?.article;
    const headline = isPresent(props.title) ? props.title : props.titleDefault;

    if (!article || !isPresent(headline)) {
      warnings.push(
        '`articleJsonLd` needs `article` metadata and a `title` — no Article node was emitted'
      );
    } else if (hasArticleNode(props.jsonLd)) {
      warnings.push(
        '`articleJsonLd` skipped: `jsonLd` already contains an Article/Posting node, which wins'
      );
    } else if (headline.length > HEADLINE_LIMIT) {
      warnings.push(
        `headline is ${headline.length} characters — Google truncates displayed headlines around ${HEADLINE_LIMIT}`
      );
    }
  }

  for (const warning of warnings) {
    console.warn(`[seo]${where} ${warning}`);
  }

  return warnings;
};
