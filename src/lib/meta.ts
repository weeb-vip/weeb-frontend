/**
 * Meta description shaping.
 *
 * The show page used to build its description with `description.substring(0, 160) + '...'`,
 * which produced three separate problems in the served HTML:
 *
 *   - cuts mid-word, so snippets ended "...he makes the noble sacrifi..."
 *   - keeps the source's newlines, and MyAnimeList synopses are multi-paragraph, so
 *     raw line breaks ended up inside the meta tag
 *   - appends "..." even when the text was already complete
 */

/** MyAnimeList boilerplate, useless in a search snippet. */
const ATTRIBUTION = /\s*\[(?:written|source)[^\]]*\]\s*$/i;

/** Trailing punctuation that reads badly immediately before an ellipsis. */
const DANGLING = /[\s,;:.\-–—]+$/;

export const DEFAULT_MAX = 160;

/**
 * Collapse to a single line, trim to `max` characters on a word boundary, and add an
 * ellipsis only when something was actually removed.
 *
 * Uses the single ellipsis character rather than three dots: search engines count
 * characters, and it reads the same for two fewer.
 */
export function metaDescription(
  raw: string | null | undefined,
  max: number = DEFAULT_MAX
): string | null {
  if (!raw) return null;

  const text = raw.replace(ATTRIBUTION, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= max) return text;

  const slice = text.slice(0, max + 1);
  const lastSpace = slice.lastIndexOf(' ');

  // Fall back to a hard cut only if the last word is absurdly long — otherwise a
  // single unbroken string would collapse the description to nothing.
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice.slice(0, max);

  return cut.replace(DANGLING, '') + '…';
}
