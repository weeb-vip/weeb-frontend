import { fromStore } from 'svelte/store';
import { getAnimeTitle, preferencesStore, type TitleLanguage } from '../stores/preferences';
import { analytics } from '../../utils/analytics';

/**
 * The two singletons every anime card used to reach for -- the title-language
 * preference and the analytics ping -- behind one pair of ports, shared by
 * AnimeCard, PosterCard, AiringStripCard and HeroAiringRail.
 *
 * Why ports and not four blocs, or one bloc instantiated four times:
 *
 * A card holds no state. It has no selection, nothing to fetch, nothing that
 * outlives a render; the only reason COMPONENT_ARCHITECTURE would hand it a
 * bloc is the store read, and a bloc *instance* per card is the wrong unit for
 * that -- the homepage draws 54 PosterCards and the profile grid draws a
 * pageful more. A bloc class here would be 54 objects wrapping one shared
 * value.
 *
 * More importantly, four blocs would be four answers to one question. The rule
 * this module encodes is the one the page blocs already follow (see
 * HomepageSSR.bloc's `titleFor`, ProfileAnimeList.bloc's `realTitleLanguage`):
 *
 *   whoever owns the preference resolves the title; a card is handed the
 *   string it should draw.
 *
 * Three of the four cards already take a resolved `title` prop, so they only
 * need the tracking seam. HeroAiringRail is given whole anime records by
 * HomepageSSR rather than titles, so it resolves them here -- through an
 * injectable `TitleLanguagePort` rather than by touching `$preferencesStore`
 * in its own markup.
 *
 * `fromStore` is lazy and lives at module scope, which is what makes the
 * shared read cost nothing per card: it subscribes only when a view actually
 * reads the language while rendering, and drops the subscription with that
 * render. That also keeps it reactive -- toggling the language still re-titles
 * the rail live, exactly as the direct `$preferencesStore` read did.
 */

/** Which title a card shows. A function, so the toggle keeps working live. */
export type TitleLanguagePort = () => TitleLanguage;

/** What a card reports when a reader opens a show. */
export type CardTrackingPort = (id: string, title: string) => void;

const preferences = fromStore(preferencesStore);

/** The real preference. Reading it inside a render makes that render reactive. */
export const realTitleLanguage: TitleLanguagePort = () => preferences.current.titleLanguage;

/** English titles, for a story or a test with no store behind it. */
export const englishTitles: TitleLanguagePort = () => 'english';

export const realCardTracking: CardTrackingPort = (id, title) => analytics.animeViewed(id, title);

/** Reports nothing. Stories inject this so opening a card is inert. */
export const noCardTracking: CardTrackingPort = () => {};

/**
 * The one title rule. Every card that resolves its own title goes through
 * here, so `titleJp || titleEn` never gets re-derived slightly differently in
 * a fifth place.
 */
export function titleFor(anime: unknown, language: TitleLanguage): string {
  return getAnimeTitle(anime, language);
}
