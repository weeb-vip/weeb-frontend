import { getSafeImageUrl } from '$lib/utils/image';

/** Which of the two airing marks a card draws, if either. */
export type CardAiringState = 'airing' | 'upcoming' | null;

/**
 * Green is airing, amber is upcoming -- and nothing else is either. The card
 * used to draw the two as its own pair of dots while AnimeCard drew "airing
 * now" in amber, which is the colour this one uses for "not out yet".
 *
 * Both vocabularies are accepted because the value reaches the card from two
 * sources: the GraphQL enum and the homepage's own lower-case shorthand.
 */
export function airingStateOf(status: string | null | undefined): CardAiringState {
  if (status === 'CURRENTLY_AIRING' || status === 'airing') return 'airing';
  if (status === 'upcoming' || status === 'NOT_YET_RELEASED') return 'upcoming';
  return null;
}

/**
 * The anime's own image at the bucket root first, TheTVDB's poster second.
 * The root object is what the scraper stores for every show, now the 424px
 * MyAnimeList copy upscaled to 600px by upscaler-service -- sharp at card
 * size on a 2x display, and the artwork the show is known by. TheTVDB's
 * poster exists only for the shows it carries and is often a different
 * piece of art, so it is the fallback rather than the lead. Works have no
 * root object: their folder stays first.
 *
 * Costs no extra request: SafeImage resolves candidates in order and stops at
 * the first that loads.
 */
export function posterSourcesFor(image: string, imagePath: string): string[] {
  if (!image) return [];
  if (imagePath === 'posters') return [getSafeImageUrl(image), getSafeImageUrl(image, imagePath)];
  return [getSafeImageUrl(image, imagePath), getSafeImageUrl(image)];
}
