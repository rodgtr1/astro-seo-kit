import { describe, expect, test } from 'vitest';
import { buildTags, normalizeJsonLd } from '../src/utils/buildTags';
import type { SeoTag, SEOProps } from '../src/types';

/** Flatten the tag model to `property|name=content` strings for readable asserts. */
const summarize = (tags: SeoTag[]): string[] =>
  tags.map((tag) => {
    if (tag.tag === 'title') return `title=${tag.text}`;
    if (tag.tag === 'jsonld') return `jsonld=${tag.json}`;
    const { attrs } = tag;
    const key = attrs.property ?? attrs.name ?? attrs.rel ?? attrs['http-equiv'];
    const value = attrs.content ?? attrs.href;
    return `${tag.tag}:${key}=${value}`;
  });

const find = (tags: SeoTag[], key: string): string | undefined =>
  tags
    .filter((tag): tag is Extract<SeoTag, { tag: 'meta' | 'link' }> => tag.tag === 'meta' || tag.tag === 'link')
    .find((tag) => tag.attrs.property === key || tag.attrs.name === key || tag.attrs.rel === key)
    ?.attrs.content ??
  undefined;

describe('title', () => {
  test('applies titleTemplate', () => {
    const tags = buildTags({ title: 'About', titleTemplate: '%s | Travis Media' });
    expect(tags[0]).toEqual({ tag: 'title', text: 'About | Travis Media' });
  });

  test('an empty titleTemplate means "no template"', () => {
    // travis.media's config sets `template: ''`. The incumbent treated the empty
    // string as falsy and skipped templating; sites depend on that.
    const tags = buildTags({ title: 'About', titleTemplate: '' });
    expect(tags[0]).toEqual({ tag: 'title', text: 'About' });
  });

  test('falls back to titleDefault when no title is given', () => {
    const tags = buildTags({ titleDefault: 'Travis Media', titleTemplate: '%s | Blog' });
    // The template is chrome for a page title; it must not decorate the default.
    expect(tags[0]).toEqual({ tag: 'title', text: 'Travis Media' });
  });

  test('omits <title> entirely when there is nothing to render', () => {
    expect(buildTags({ description: 'x' }).some((tag) => tag.tag === 'title')).toBe(false);
  });

  test('og:title uses the raw title, not the templated one', () => {
    const tags = buildTags({ title: 'About', titleTemplate: '%s | Travis Media', openGraph: {} });
    expect(find(tags, 'og:title')).toBe('About');
  });
});

describe('robots', () => {
  test('emits nothing when neither noindex nor nofollow is set', () => {
    expect(find(buildTags({ title: 'x' }), 'robots')).toBeUndefined();
  });

  test('emits index,follow for explicit false', () => {
    expect(find(buildTags({ noindex: false, nofollow: false }), 'robots')).toBe('index,follow');
  });

  test('emits noindex,nofollow for explicit true', () => {
    expect(find(buildTags({ noindex: true, nofollow: true }), 'robots')).toBe('noindex,nofollow');
  });

  test('serializes every robotsProps directive', () => {
    const content = find(
      buildTags({
        noindex: false,
        robotsProps: {
          nosnippet: true,
          maxSnippet: 50,
          maxImagePreview: 'large',
          maxVideoPreview: 30,
          noarchive: true,
          unavailableAfter: '2030-01-01',
          noimageindex: true,
          notranslate: true,
        },
      }),
      'robots'
    );

    expect(content).toBe(
      'index,nosnippet,max-snippet:50,max-image-preview:large,max-video-preview:30,noarchive,unavailable_after:2030-01-01,noimageindex,notranslate'
    );
  });

  test('max-snippet:0 is emitted (0 is meaningful, not absent)', () => {
    expect(find(buildTags({ robotsProps: { maxSnippet: 0 } }), 'robots')).toBe('max-snippet:0');
  });

  test('emits max-video-preview, which the incumbent typed but silently dropped', () => {
    expect(find(buildTags({ robotsProps: { maxVideoPreview: -1 } }), 'robots')).toBe('max-video-preview:-1');
  });
});

describe('canonical', () => {
  test('resolves a relative canonical against site', () => {
    const tags = buildTags({ canonical: '/blog/post/', site: 'https://travis.media' });
    expect(find(tags, 'canonical')).toBeUndefined(); // links carry href, not content
    const link = tags.find((tag) => tag.tag === 'link');
    expect(link).toEqual({ tag: 'link', attrs: { rel: 'canonical', href: 'https://travis.media/blog/post/' } });
  });

  test('leaves an absolute canonical untouched', () => {
    const tags = buildTags({ canonical: 'https://example.com/a/', site: 'https://travis.media' });
    expect(tags.find((tag) => tag.tag === 'link')?.attrs.href).toBe('https://example.com/a/');
  });

  test('canonical={false} suppresses the tag', () => {
    const tags = buildTags({ canonical: false, title: 'x' });
    expect(tags.some((tag) => tag.tag === 'link')).toBe(false);
  });

  test('accepts a URL instance', () => {
    const tags = buildTags({ canonical: new URL('https://travis.media/x/') });
    expect(tags.find((tag) => tag.tag === 'link')?.attrs.href).toBe('https://travis.media/x/');
  });
});

describe('open graph images', () => {
  test('the top-level image prop accepts a bare URL string', () => {
    const tags = buildTags({ image: 'https://travis.media/og.png' });
    expect(find(tags, 'og:image')).toBe('https://travis.media/og.png');
  });

  test('absolutizes a relative image against site', () => {
    const tags = buildTags({ site: 'https://travis.media', image: '/og.png' });
    expect(find(tags, 'og:image')).toBe('https://travis.media/og.png');
  });

  test('openGraph.images stays an array of objects, so callers can still read .url', () => {
    // travis.media's adaptOpenGraphImages maps over these and reads image.url /
    // .width / .height. Widening this to `string | OpenGraphMedia` would break
    // every such consumer, so the string sugar lives on `image` instead.
    const images = [{ url: 'https://travis.media/og.png', width: 1200 }];
    const tags = buildTags({ openGraph: { images } });
    expect(find(tags, 'og:image')).toBe('https://travis.media/og.png');
    expect(images[0].url).toBe('https://travis.media/og.png');
  });

  test('skips images whose URL is empty rather than emitting a blank tag', () => {
    // The incumbent emitted `<meta property="og:image" content="">` here, which
    // is how travis.media shipped empty card images for unresolvable assets.
    const tags = buildTags({ openGraph: { images: [{ url: '' }, { url: '  ' }] } });
    expect(tags.some((tag) => tag.tag === 'meta' && tag.attrs.property === 'og:image')).toBe(false);
  });

  test('emits full media metadata in OG-spec order', () => {
    const tags = buildTags({
      openGraph: {
        images: [{ url: 'https://travis.media/og.png', alt: 'Alt', width: 1200, height: 630, secureUrl: 'https://travis.media/og.png' }],
      },
    });

    expect(summarize(tags)).toEqual([
      'meta:og:type=website',
      'meta:og:image=https://travis.media/og.png',
      'meta:og:image:alt=Alt',
      'meta:og:image:secure_url=https://travis.media/og.png',
      'meta:og:image:type=image/png',
      'meta:og:image:width=1200',
      'meta:og:image:height=630',
    ]);
  });

  test('infers the MIME type from the extension, and an explicit type wins', () => {
    expect(find(buildTags({ image: 'https://x.com/a.webp' }), 'og:image:type')).toBe('image/webp');
    expect(find(buildTags({ image: 'https://x.com/a.avif?v=2' }), 'og:image:type')).toBe('image/avif');
    expect(find(buildTags({ image: { url: 'https://x.com/a', type: 'image/gif' } }), 'og:image:type')).toBe('image/gif');
    expect(find(buildTags({ image: 'https://x.com/a' }), 'og:image:type')).toBeUndefined();
  });

  test('top-level image is shorthand for openGraph.images', () => {
    const tags = buildTags({ image: { url: 'https://travis.media/og.png', alt: 'Hi' } });
    expect(find(tags, 'og:image')).toBe('https://travis.media/og.png');
    expect(find(tags, 'og:image:alt')).toBe('Hi');
    expect(find(tags, 'og:type')).toBe('website');
  });
});

describe('open graph type', () => {
  test('defaults to website when OG data is present but no type is given', () => {
    expect(find(buildTags({ openGraph: {} }), 'og:type')).toBe('website');
  });

  test('an explicit type wins', () => {
    expect(find(buildTags({ openGraph: { type: 'profile' } }), 'og:type')).toBe('profile');
  });

  test('article metadata implies og:type=article', () => {
    expect(find(buildTags({ article: { section: 'Dev' } }), 'og:type')).toBe('article');
  });

  test('no OG tags at all when there is no OG data', () => {
    const tags = buildTags({ title: 'x', description: 'y' });
    expect(tags.some((tag) => tag.tag === 'meta' && tag.attrs.property?.startsWith('og:'))).toBe(false);
  });
});

describe('article metadata', () => {
  test('serializes Date objects to ISO 8601 and emits publisher', () => {
    const tags = buildTags({
      article: {
        publishedTime: new Date('2026-07-13T10:00:00.000Z'),
        modifiedTime: '2026-07-14',
        authors: ['https://travis.media/about/'],
        publisher: 'https://facebook.com/travismedia',
        section: 'Development',
        tags: ['astro', 'seo'],
      },
    });

    expect(find(tags, 'article:published_time')).toBe('2026-07-13T10:00:00.000Z');
    expect(find(tags, 'article:modified_time')).toBe('2026-07-14');
    expect(find(tags, 'article:author')).toBe('https://travis.media/about/');
    expect(find(tags, 'article:publisher')).toBe('https://facebook.com/travismedia');
    expect(find(tags, 'article:section')).toBe('Development');
    expect(summarize(tags).filter((entry) => entry.startsWith('meta:article:tag'))).toEqual([
      'meta:article:tag=astro',
      'meta:article:tag=seo',
    ]);
  });

  test('openGraph.article still works', () => {
    const tags = buildTags({ openGraph: { type: 'article', article: { section: 'Dev' } } });
    expect(find(tags, 'article:section')).toBe('Dev');
  });

  test('object-type vocabularies are not og:-prefixed', () => {
    // @astrolib/seo emits `og:article:section`, `og:book:isbn`, `og:profile:username`
    // and `og:video:duration`. Per ogp.me these are separate namespaces, and no
    // consumer recognizes the prefixed form. (astrolib#25)
    const tags = buildTags({
      openGraph: {
        article: { section: 'Dev' },
        book: { isbn: '978-3-16-148410-0' },
        profile: { username: 'travis' },
        video: { duration: 120 },
      },
    });

    const properties = tags
      .filter((tag) => tag.tag === 'meta')
      .map((tag) => (tag as Extract<SeoTag, { tag: 'meta' }>).attrs.property)
      .filter((property): property is string => Boolean(property));

    expect(properties).toContain('article:section');
    expect(properties).toContain('book:isbn');
    expect(properties).toContain('profile:username');
    expect(properties).toContain('video:duration');
    expect(properties.filter((property) => property.startsWith('og:article'))).toEqual([]);
    expect(properties.filter((property) => property.startsWith('og:book'))).toEqual([]);
    expect(properties.filter((property) => property.startsWith('og:profile'))).toEqual([]);
    expect(properties.filter((property) => property.startsWith('og:video:duration'))).toEqual([]);
  });

  test('og:video media properties stay prefixed', () => {
    // Structured properties of the og:video *media* object are still og:-prefixed;
    // only the video object-type vocabulary (video:actor, ...) is not.
    const tags = buildTags({ openGraph: { videos: [{ url: 'https://x.com/v.mp4', width: 640 }] } });
    expect(find(tags, 'og:video')).toBe('https://x.com/v.mp4');
    expect(find(tags, 'og:video:width')).toBe('640');
    expect(find(tags, 'og:video:type')).toBe('video/mp4');
  });
});

describe('twitter', () => {
  test('supports both the modern and the legacy spelling', () => {
    const modern = buildTags({ twitter: { card: 'summary_large_image', creator: '@travisdotmedia' } });
    const legacy = buildTags({ twitter: { cardType: 'summary_large_image', handle: '@travisdotmedia' } });

    expect(find(modern, 'twitter:card')).toBe('summary_large_image');
    expect(find(modern, 'twitter:creator')).toBe('@travisdotmedia');
    expect(summarize(modern)).toEqual(summarize(legacy));
  });

  test('does not mirror og:* by default — X already falls back to them', () => {
    const tags = buildTags({
      title: 'T',
      description: 'D',
      openGraph: { images: [{ url: 'https://x.com/a.png' }] },
      twitter: { card: 'summary' },
    });

    expect(find(tags, 'twitter:title')).toBeUndefined();
    expect(find(tags, 'twitter:description')).toBeUndefined();
    expect(find(tags, 'twitter:image')).toBeUndefined();
  });

  test('emits the overrides when they are set explicitly', () => {
    const tags = buildTags({
      site: 'https://travis.media',
      twitter: { card: 'summary', title: 'Card title', image: '/card.png', imageAlt: 'Alt' },
    });

    expect(find(tags, 'twitter:title')).toBe('Card title');
    expect(find(tags, 'twitter:image')).toBe('https://travis.media/card.png');
    expect(find(tags, 'twitter:image:alt')).toBe('Alt');
  });

  test('twitter={false} emits nothing', () => {
    const tags = buildTags({ title: 'x', twitter: false });
    expect(tags.some((tag) => tag.tag === 'meta' && tag.attrs.name?.startsWith('twitter:'))).toBe(false);
  });
});

describe('additional tags', () => {
  test('emits name, property and http-equiv meta tags', () => {
    const tags = buildTags({
      additionalMetaTags: [
        { name: 'theme-color', content: '#0f172a' },
        { property: 'dc:creator', content: 'Travis' },
        { httpEquiv: 'x-ua-compatible', content: 'IE=edge' },
      ],
    });

    expect(tags).toEqual([
      { tag: 'meta', attrs: { name: 'theme-color', content: '#0f172a' } },
      { tag: 'meta', attrs: { property: 'dc:creator', content: 'Travis' } },
      { tag: 'meta', attrs: { 'http-equiv': 'x-ua-compatible', content: 'IE=edge' } },
    ]);
  });

  test('maps crossOrigin to the crossorigin attribute and resolves href', () => {
    const tags = buildTags({
      site: 'https://travis.media',
      additionalLinkTags: [{ rel: 'preload', href: '/font.woff2', as: 'font', crossOrigin: 'anonymous' }],
    });

    expect(tags[0]).toEqual({
      tag: 'link',
      attrs: { rel: 'preload', href: 'https://travis.media/font.woff2', as: 'font', crossorigin: 'anonymous' },
    });
  });
});

describe('json-ld', () => {
  test('injects @context when absent', () => {
    expect(normalizeJsonLd({ '@type': 'Person', name: 'Travis' })).toEqual([
      '{"@context":"https://schema.org","@type":"Person","name":"Travis"}',
    ]);
  });

  test('respects an explicit @context', () => {
    const [json] = normalizeJsonLd({ '@context': 'https://example.org', '@type': 'Thing' });
    expect(JSON.parse(json)['@context']).toBe('https://example.org');
  });

  test('emits one script per node', () => {
    expect(normalizeJsonLd([{ '@type': 'A' }, { '@type': 'B' }])).toHaveLength(2);
  });

  test('ignores empty input', () => {
    expect(normalizeJsonLd(undefined)).toEqual([]);
    expect(normalizeJsonLd({})).toEqual([]);
    expect(normalizeJsonLd([])).toEqual([]);
  });

  test('escaping does not mutate the data', () => {
    // The other way to make JSON-LD breakout-safe is to HTML-entity-escape the
    // string values. It works, but script content is raw text and is never
    // entity-decoded, so consumers would read back "Tom &amp; Jerry". Unicode
    // escapes keep the decoded value identical to what was passed in.
    const headline = 'Tom & Jerry < > "quoted"';
    const [json] = normalizeJsonLd({ '@type': 'Article', headline });

    expect(json).not.toContain('&amp;');
    expect(json).not.toContain('&lt;');
    expect(JSON.parse(json).headline).toBe(headline);
  });

  test('cannot break out of the script element', () => {
    const [json] = normalizeJsonLd({ '@type': 'Article', headline: '</script><img src=x onerror=alert(1)>' });

    expect(json).not.toContain('</script>');
    expect(json).not.toContain('<');
    expect(json).not.toContain('>');
    // ...and the payload still decodes to exactly the original string.
    expect(JSON.parse(json).headline).toBe('</script><img src=x onerror=alert(1)>');
  });

  test('escapes JS line terminators that are legal in JSON', () => {
    // U+2028/U+2029 are invisible; build them explicitly rather than pasting them.
    const headline = ['a', String.fromCharCode(0x2028), 'b', String.fromCharCode(0x2029), 'c'].join('');
    const [json] = normalizeJsonLd({ '@type': 'Article', headline });

    expect(json).toContain('\\u2028');
    expect(json).toContain('\\u2029');
    expect(JSON.parse(json).headline).toBe(headline);
  });
});

describe('@astrolib/seo compatibility', () => {
  // The exact prop object travis.media's Metadata.astro produces for a post.
  const props: SEOProps = {
    title: 'A Post',
    titleTemplate: '',
    canonical: 'https://travis.media/blog/a-post/',
    noindex: false,
    nofollow: false,
    description: 'About the post.',
    openGraph: {
      url: 'https://travis.media/blog/a-post/',
      site_name: 'Travis Media',
      images: [{ url: 'https://travis.media/hero.webp', width: 1200, height: 626 }],
      locale: 'en',
      type: 'article',
    },
    twitter: { handle: '@travisdotmedia', site: '@travisdotmedia', cardType: 'summary_large_image' },
  };

  test('reproduces the incumbent tag sequence', () => {
    expect(summarize(buildTags(props))).toEqual([
      'title=A Post',
      'meta:description=About the post.',
      'meta:robots=index,follow',
      'link:canonical=https://travis.media/blog/a-post/',
      'meta:og:title=A Post',
      'meta:og:description=About the post.',
      'meta:og:url=https://travis.media/blog/a-post/',
      'meta:og:type=article',
      'meta:og:image=https://travis.media/hero.webp',
      // og:image:type is the one addition — inferred from the extension.
      'meta:og:image:type=image/webp',
      'meta:og:image:width=1200',
      'meta:og:image:height=626',
      'meta:og:locale=en',
      'meta:og:site_name=Travis Media',
      'meta:twitter:card=summary_large_image',
      'meta:twitter:site=@travisdotmedia',
      'meta:twitter:creator=@travisdotmedia',
    ]);
  });

  test('siteName and site_name are equivalent', () => {
    expect(find(buildTags({ openGraph: { siteName: 'TM' } }), 'og:site_name')).toBe('TM');
    expect(find(buildTags({ openGraph: { site_name: 'TM' } }), 'og:site_name')).toBe('TM');
  });
});
