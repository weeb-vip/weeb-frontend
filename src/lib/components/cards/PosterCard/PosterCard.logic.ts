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
 * Prefer TheTVDB's 680x1000 series poster over the scraper's MyAnimeList
 * image, which MAL serves at 225px wide -- soft on any 2x display at card
 * size, and this component renders 54 times on the homepage alone. Falls back
 * per-anime, so the shows TheTVDB does not carry are unaffected.
 *
 * Costs no extra request: SafeImage resolves candidates in order and stops at
 * the first that loads.
 */
export function posterSourcesFor(image: string, imagePath: string): string[] {
  return image ? [getSafeImageUrl(image, imagePath), getSafeImageUrl(image)] : [];
}
