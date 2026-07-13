import type { MaybeRelativeUrl, SEOProps } from '../types';

const isRelative = (url: unknown): boolean =>
  typeof url === 'string' && url.trim() !== '' && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());

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

  if (!props.title && !props.titleDefault) {
    warnings.push('no `title` — the page will have no <title> tag');
  }

  if (!props.description) {
    warnings.push('no `description` — search engines will synthesize a snippet from the page body');
  }

  if (!props.canonical) {
    warnings.push('no `canonical` — duplicate-content risk if this page is reachable at more than one URL');
  }

  const images = props.openGraph?.images ?? [];
  if (!site) {
    const relative = [
      props.canonical,
      props.openGraph?.url,
      ...images.map((image) => (typeof image === 'string' ? image : image?.url)),
    ].filter(isRelative);

    if (relative.length > 0) {
      warnings.push(
        `relative URL(s) [${relative.join(', ')}] could not be made absolute: set \`site\` in astro.config, ` +
          'or pass `site` to <SEO />. Crawlers ignore relative og:image and og:url.'
      );
    }
  }

  for (const image of images) {
    if (typeof image !== 'string' && image?.url && !image.alt) {
      warnings.push(`og:image "${image.url}" has no \`alt\``);
    }
  }

  for (const warning of warnings) {
    console.warn(`[seo]${where} ${warning}`);
  }

  return warnings;
};
