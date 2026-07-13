import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test } from 'vitest';
import SEO from '../src/SEO.astro';
import JsonLd from '../src/JsonLd.astro';
import type { SEOProps } from '../src/types';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;

beforeAll(async () => {
  container = await AstroContainer.create();
});

// The container types `props` as Record<string, unknown>, and a TS interface has
// no implicit index signature — hence the cast. The SEOProps annotation is what
// actually type-checks each test's props.
const render = (props: SEOProps) =>
  container.renderToString(SEO, { props: props as Record<string, unknown> });

describe('rendered output', () => {
  test('renders the full head for a typical article page', async () => {
    const html = await render({
      title: 'Astro SEO',
      titleTemplate: '%s | Travis Media',
      description: 'How to do SEO in Astro.',
      canonical: '/blog/astro-seo/',
      site: 'https://travis.media',
      noindex: false,
      nofollow: false,
      image: { url: '/og/astro-seo.png', alt: 'Cover', width: 1200, height: 630 },
      article: { publishedTime: new Date('2026-07-13T00:00:00Z'), authors: ['Travis Rodgers'], tags: ['astro'] },
      openGraph: { siteName: 'Travis Media', locale: 'en' },
      twitter: { card: 'summary_large_image', site: '@travisdotmedia' },
    });

    expect(html).toMatchInlineSnapshot(`
      "<title>Astro SEO | Travis Media</title>
      <meta name="description" content="How to do SEO in Astro.">
      <meta name="robots" content="index,follow">
      <link rel="canonical" href="https://travis.media/blog/astro-seo/">
      <meta property="og:title" content="Astro SEO">
      <meta property="og:description" content="How to do SEO in Astro.">
      <meta property="og:url" content="https://travis.media/blog/astro-seo/">
      <meta property="og:type" content="article">
      <meta property="og:image" content="https://travis.media/og/astro-seo.png">
      <meta property="og:image:alt" content="Cover">
      <meta property="og:image:type" content="image/png">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      <meta property="og:locale" content="en">
      <meta property="og:site_name" content="Travis Media">
      <meta property="article:published_time" content="2026-07-13T00:00:00.000Z">
      <meta property="article:author" content="Travis Rodgers">
      <meta property="article:tag" content="astro">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:site" content="@travisdotmedia">"
    `);
  });

  test('renders void elements unclosed, as @astrolib/seo did', async () => {
    const html = await render({ description: 'x' });
    expect(html).toBe('<meta name="description" content="x">');
  });

  test('escapes the title text content', async () => {
    const html = await render({ title: `Tom & Jerry's <b>tags</b>` });
    expect(html).toBe(`<title>Tom &amp; Jerry&#39;s &lt;b&gt;tags&lt;/b&gt;</title>`);
  });

  test('escapes attribute values so they cannot break out of the attribute', async () => {
    const html = await render({ description: `He said "hi" & left` });

    // `"` and `&` are the characters that can terminate or corrupt an attribute;
    // Astro escapes both. `'`, `<` and `>` are legal raw inside a double-quoted
    // attribute value, so Astro leaves them — the HTML is equivalent either way.
    expect(html).toBe('<meta name="description" content="He said &quot;hi&quot; &amp; left">');
    expect(html).not.toContain('"hi"');
  });

  test('an injected quote cannot forge a new attribute', async () => {
    const html = await render({ description: `x" onload="alert(1)` });
    expect(html).toBe('<meta name="description" content="x&quot; onload=&quot;alert(1)">');
  });

  test('emits nothing at all for empty props', async () => {
    expect((await render({})).trim()).toBe('');
  });
});

describe('json-ld rendering', () => {
  test('renders a script tag via the jsonLd prop', async () => {
    const html = await render({ jsonLd: { '@type': 'Person', name: 'Travis Rodgers' } });

    expect(html).toBe(
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"Travis Rodgers"}</script>'
    );
  });

  test('a hostile headline cannot close the script element', async () => {
    const html = await render({
      jsonLd: { '@type': 'Article', headline: '</script><script>alert(1)</script>' },
    });

    // Exactly one opening and one closing script tag: no breakout.
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);

    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(json).headline).toBe('</script><script>alert(1)</script>');
  });

  test('the standalone <JsonLd /> component renders one script per node', async () => {
    const html = await container.renderToString(JsonLd, {
      props: { schema: [{ '@type': 'Person', name: 'A' }, { '@type': 'Organization', name: 'B' }] },
    });

    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).toContain('"name":"A"');
    expect(html).toContain('"name":"B"');
  });
});
