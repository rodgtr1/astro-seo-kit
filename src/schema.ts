/**
 * Optional typed entry point — schema.org vocabulary checking for JSON-LD.
 *
 *   npm install -D schema-dts
 *   import { defineSchema } from 'astro-seo-kit/schema';
 *
 * `schema-dts` is a types-only optional peer: this file is the only one that
 * imports it, and the package ships as source, so nothing here is ever
 * compiled — or required — unless you import this subpath. The main entry
 * stays dependency-free.
 */
import type { Thing, WithContext } from 'schema-dts';
import type { JsonLdObject } from './types';

/**
 * Identity function that type-checks a node against the schema.org vocabulary,
 * then hands it back shaped for the `jsonLd` prop (or `<JsonLd schema={...} />`):
 *
 *   <SEO jsonLd={defineSchema({ '@type': 'BlogPosting', headline: '...' })} />
 *
 * A typo'd `@type` or property name is now a compile error instead of a node
 * that search engines silently ignore. `@context` may be omitted — the
 * component injects it either way.
 */
export const defineSchema = <T extends Thing>(
  node: WithContext<T> | Exclude<T, string>
): JsonLdObject => node as JsonLdObject;

export type { Thing, WithContext } from 'schema-dts';
