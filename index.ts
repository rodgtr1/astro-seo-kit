export { default as SEO } from './src/SEO.astro';
export { default as JsonLd } from './src/JsonLd.astro';

/**
 * Drop-in alias for `@astrolib/seo`, so migrating is an import-path change:
 *
 *   -import { AstroSeo } from '@astrolib/seo';
 *   +import { AstroSeo } from 'astro-seo-kit';
 */
export { default as AstroSeo } from './src/SEO.astro';

export { buildTags } from './src/utils/buildTags';

export type * from './src/types';
