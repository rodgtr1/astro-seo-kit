import { afterEach, describe, expect, test, vi } from 'vitest';
import { warnAboutProps } from '../src/utils/validate';

// Silence the console output; the assertions run on the returned array.
vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
});

const SITE = 'https://travis.media';

const full = {
  title: 'A Post',
  description: 'About the post.',
  canonical: 'https://travis.media/blog/a-post/',
};

describe('presence warnings', () => {
  test('a fully specified page produces no warnings', () => {
    expect(warnAboutProps(full, SITE)).toEqual([]);
  });

  test('warns about missing title, description and canonical', () => {
    const warnings = warnAboutProps({}, SITE);
    expect(warnings.some((warning) => warning.includes('`title`'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('`description`'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('`canonical`'))).toBe(true);
  });

  test('whitespace-only values are treated as absent, matching what gets rendered', () => {
    const warnings = warnAboutProps({ title: '  ', description: ' ' }, SITE);
    expect(warnings.some((warning) => warning.includes('`title`'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('`description`'))).toBe(true);
  });

  test('canonical={false} is a deliberate opt-out, not a mistake', () => {
    const warnings = warnAboutProps({ ...full, canonical: false }, SITE);
    expect(warnings).toEqual([]);
  });
});

describe('image warnings', () => {
  test('the top-level image shorthand is checked for a missing alt', () => {
    const warnings = warnAboutProps({ ...full, image: { url: '/og.png' } }, SITE);
    expect(warnings.some((warning) => warning.includes('no `alt`'))).toBe(true);
  });

  test('openGraph.images are checked for a missing alt', () => {
    const warnings = warnAboutProps({ ...full, openGraph: { images: [{ url: '/og.png' }] } }, SITE);
    expect(warnings.some((warning) => warning.includes('no `alt`'))).toBe(true);
  });

  test('an image with an alt is fine, and a bare string image cannot carry one', () => {
    expect(warnAboutProps({ ...full, image: { url: '/og.png', alt: 'Cover' } }, SITE)).toEqual([]);
    // A string image has no alt field to forget; the warning is about the object form.
    expect(warnAboutProps({ ...full, image: '/og.png' }, SITE)).toEqual([]);
  });
});

describe('articleJsonLd warnings', () => {
  const article = { publishedTime: '2026-07-13' };

  test('warns when articleJsonLd is set without article metadata or a title', () => {
    const warnings = warnAboutProps({ ...full, articleJsonLd: true }, SITE);
    expect(warnings.some((warning) => warning.includes('`articleJsonLd` needs'))).toBe(true);
    expect(warnAboutProps({ ...full, title: undefined, article, articleJsonLd: true }, SITE).some(
      (warning) => warning.includes('`articleJsonLd` needs')
    )).toBe(true);
  });

  test('warns when a user-supplied Article node causes derivation to be skipped', () => {
    const warnings = warnAboutProps(
      { ...full, article, articleJsonLd: true, jsonLd: { '@type': 'BlogPosting' } },
      SITE
    );
    expect(warnings.some((warning) => warning.includes('skipped'))).toBe(true);
  });

  test('warns about headlines Google will truncate', () => {
    const warnings = warnAboutProps(
      { ...full, title: 'x'.repeat(120), article, articleJsonLd: true },
      SITE
    );
    expect(warnings.some((warning) => warning.includes('truncates'))).toBe(true);
  });

  test('a well-formed derivation warns about nothing', () => {
    expect(warnAboutProps({ ...full, article, articleJsonLd: true }, SITE)).toEqual([]);
  });
});

describe('relative URLs without a site', () => {
  test('flags a relative canonical, top-level image and twitter image', () => {
    const warnings = warnAboutProps(
      { title: 'x', description: 'y', canonical: '/post/', image: '/og.png', twitter: { image: '/card.png' } },
      undefined
    );
    const relative = warnings.find((warning) => warning.includes('could not be made absolute'));
    expect(relative).toContain('/post/');
    expect(relative).toContain('/og.png');
    expect(relative).toContain('/card.png');
  });

  test('absolute URLs are not flagged even without a site', () => {
    const warnings = warnAboutProps(full, undefined);
    expect(warnings.some((warning) => warning.includes('could not be made absolute'))).toBe(false);
  });
});
