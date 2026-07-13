import { describe, expect, test } from 'vitest';
import { articleJsonLd, hasArticleNode } from '../src/utils/articleJsonLd';
import { buildTags } from '../src/utils/buildTags';
import { defineSchema } from '../src/schema';
import type { SeoTag, SEOProps } from '../src/types';

const post: SEOProps = {
  title: 'Why I switched to Astro',
  titleTemplate: '%s | Travis Media',
  description: 'A honest look at the migration.',
  canonical: '/blog/why-astro/',
  site: 'https://travis.media',
  image: { url: '/og/why-astro.png', alt: 'Cover' },
  openGraph: { siteName: 'Travis Media' },
  article: {
    publishedTime: '2026-07-13T10:00:00.000Z',
    authors: ['Travis Rodgers', 'https://travis.media/about/'],
    section: 'Development',
    tags: ['astro', 'seo'],
  },
};

const jsonLdTags = (tags: SeoTag[]): unknown[] =>
  tags
    .filter((tag): tag is Extract<SeoTag, { tag: 'jsonld' }> => tag.tag === 'jsonld')
    .map((tag) => JSON.parse(tag.json));

describe('articleJsonLd builder', () => {
  test('derives the full node from SEO props', () => {
    expect(articleJsonLd(post)).toEqual({
      '@type': 'Article',
      '@id': 'https://travis.media/blog/why-astro/#article',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://travis.media/blog/why-astro/' },
      headline: 'Why I switched to Astro', // raw title — the template is tab chrome
      description: 'A honest look at the migration.',
      image: ['https://travis.media/og/why-astro.png'],
      datePublished: '2026-07-13T10:00:00.000Z',
      dateModified: '2026-07-13T10:00:00.000Z', // falls back to datePublished
      author: [
        { '@type': 'Person', name: 'Travis Rodgers' },
        { '@type': 'Person', url: 'https://travis.media/about/' },
      ],
      publisher: { '@type': 'Organization', name: 'Travis Media' },
      articleSection: 'Development',
      keywords: 'astro, seo',
    });
  });

  test('a single author is a node, not a one-element array', () => {
    const node = articleJsonLd({ ...post, article: { ...post.article, authors: ['Travis Rodgers'] } });
    expect(node?.author).toEqual({ '@type': 'Person', name: 'Travis Rodgers' });
  });

  test('serializes Date values and keeps an explicit modifiedTime', () => {
    const node = articleJsonLd({
      ...post,
      article: {
        publishedTime: new Date('2026-07-01T00:00:00.000Z'),
        modifiedTime: new Date('2026-07-13T00:00:00.000Z'),
      },
    });
    expect(node?.datePublished).toBe('2026-07-01T00:00:00.000Z');
    expect(node?.dateModified).toBe('2026-07-13T00:00:00.000Z');
  });

  test('returns undefined without article metadata or a title', () => {
    expect(articleJsonLd({ ...post, article: undefined, openGraph: {} })).toBeUndefined();
    expect(articleJsonLd({ ...post, title: undefined })).toBeUndefined();
  });

  test('canonical={false} drops @id and mainEntityOfPage, nothing else', () => {
    const node = articleJsonLd({ ...post, canonical: false });
    expect(node).not.toHaveProperty('@id');
    expect(node).not.toHaveProperty('mainEntityOfPage');
    expect(node?.headline).toBe('Why I switched to Astro');
  });

  test('overrides merge last, so any derived field can be corrected', () => {
    const node = articleJsonLd(post, {
      '@type': 'BlogPosting',
      publisher: { '@type': 'Organization', name: 'TM Inc', logo: 'https://travis.media/logo.png' },
    });
    expect(node?.['@type']).toBe('BlogPosting');
    expect(node?.publisher).toEqual({
      '@type': 'Organization',
      name: 'TM Inc',
      logo: 'https://travis.media/logo.png',
    });
    expect(node?.headline).toBe('Why I switched to Astro'); // untouched fields survive
  });

  test('article.publisher (a Facebook profile URL) is NOT used as schema publisher', () => {
    const node = articleJsonLd({
      ...post,
      openGraph: {},
      article: { ...post.article, publisher: 'https://facebook.com/travismedia' },
    });
    expect(node).not.toHaveProperty('publisher');
  });
});

describe('hasArticleNode', () => {
  test('matches *Article and *Posting types, including array @type', () => {
    expect(hasArticleNode({ '@type': 'BlogPosting' })).toBe(true);
    expect(hasArticleNode({ '@type': 'NewsArticle' })).toBe(true);
    expect(hasArticleNode([{ '@type': 'Person' }, { '@type': ['Thing', 'TechArticle'] }])).toBe(true);
    expect(hasArticleNode({ '@type': 'Product' })).toBe(false);
    expect(hasArticleNode(undefined)).toBe(false);
  });
});

describe('articleJsonLd via buildTags', () => {
  test('articleJsonLd={true} emits the derived node with @context injected', () => {
    const [node] = jsonLdTags(buildTags({ ...post, articleJsonLd: true })) as Record<string, unknown>[];
    expect(node['@context']).toBe('https://schema.org');
    expect(node['@type']).toBe('Article');
    expect(node.headline).toBe('Why I switched to Astro');
  });

  test('the derived node comes first; user nodes keep their order', () => {
    const nodes = jsonLdTags(
      buildTags({ ...post, articleJsonLd: true, jsonLd: { '@type': 'BreadcrumbList' } })
    ) as Record<string, unknown>[];
    expect(nodes.map((node) => node['@type'])).toEqual(['Article', 'BreadcrumbList']);
  });

  test('a user-supplied Article node wins and derivation is skipped', () => {
    const nodes = jsonLdTags(
      buildTags({ ...post, articleJsonLd: true, jsonLd: { '@type': 'BlogPosting', headline: 'Mine' } })
    ) as Record<string, unknown>[];
    expect(nodes).toHaveLength(1);
    expect(nodes[0].headline).toBe('Mine');
  });

  test('an object value both enables and overrides', () => {
    const [node] = jsonLdTags(
      buildTags({ ...post, articleJsonLd: { '@type': 'BlogPosting' } })
    ) as Record<string, unknown>[];
    expect(node['@type']).toBe('BlogPosting');
  });

  test('emits nothing when derivation has nothing to work with', () => {
    const tags = buildTags({ title: 'x', articleJsonLd: true });
    expect(tags.some((tag) => tag.tag === 'jsonld')).toBe(false);
  });
});

describe('typed schema entry', () => {
  test('defineSchema is an identity that feeds the jsonLd prop', () => {
    const node = defineSchema({ '@type': 'BlogPosting', headline: 'Typed' });
    const [emitted] = jsonLdTags(buildTags({ jsonLd: node })) as Record<string, unknown>[];
    expect(emitted.headline).toBe('Typed');
    expect(emitted['@context']).toBe('https://schema.org');
  });

  test('interface-typed nodes (no index signature) are accepted by jsonLd', () => {
    // This is a compile-time regression test: schema-dts values stored in a
    // variable are interface-typed and used to fail against Record<string, unknown>.
    const stored = defineSchema({ '@type': 'Person', name: 'Travis' });
    expect(jsonLdTags(buildTags({ jsonLd: stored }))).toHaveLength(1);
  });
});
