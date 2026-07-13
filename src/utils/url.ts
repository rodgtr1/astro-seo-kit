import type { MaybeRelativeUrl } from '../types';

/** Values that are present but carry no URL. */
const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

/**
 * Absolutize `url` against `site`.
 *
 * Crawlers reject relative `og:image` / `og:url`, so this runs on every URL the
 * component emits. Already-absolute URLs pass through untouched. A relative URL
 * with no `site` to resolve against is returned as-is (and warned about in dev)
 * rather than dropped — better a relative tag than a missing one.
 */
export const resolveUrl = (
  url: MaybeRelativeUrl | undefined,
  site?: MaybeRelativeUrl | undefined
): string | undefined => {
  if (url instanceof URL) return url.href;
  if (isBlank(url)) return undefined;

  const raw = (url as string).trim();

  // Protocol-relative and absolute URLs are already resolvable by a crawler.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return raw;

  if (!site) return raw;

  try {
    const base = site instanceof URL ? site : new URL(String(site));
    return new URL(raw, base).href;
  } catch {
    return raw;
  }
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
};

/** Best-effort MIME type from a URL's file extension; `undefined` if unknown. */
export const inferMimeType = (url: string): string | undefined => {
  const withoutQuery = url.split(/[?#]/, 1)[0];
  const extension = withoutQuery.split('.').pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] : undefined;
};

/** Serialize a date-ish value to ISO 8601, which is what the OG spec wants. */
export const toIsoString = (value: string | Date | undefined): string | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  return isBlank(value) ? undefined : (value as string);
};
