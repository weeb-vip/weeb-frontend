import { GetImageFromAnime, getYearUTC } from '$lib/services/utils';
import { readableWorkType } from '$lib/utils/workDisplay';

/**
 * What one search hit renders as. Anime and works come from two indexes with
 * two shapes, and every difference between them is decided here so the row's
 * markup is one shape.
 */

export interface AutocompleteItemView {
  /** A record id for SafeImage to build a CDN URL from -- never a finished URL. */
  imageSrc: string;
  /** The CDN folder the cover lives in. */
  imagePath: string;
  /** Used only if the cover has not reached the CDN. */
  imageFallback: string;
  /** The line under the title. */
  subtitle: string;
}

/**
 * Works come from a different index and are tagged at the source, so this never
 * has to infer which one a hit came from by sniffing its fields.
 */
export function isWorkHit(item: any): boolean {
  return item?.__kind === 'work';
}

export function autocompleteItemView(item: any): AutocompleteItemView {
  const isWork = isWorkHit(item);

  return {
    // SafeImage takes a record id and the CDN folder it lives in, and builds
    // the URL itself -- handing it a finished URL gets that URL encoded into
    // another one. Works are stored under works/; anime posters sit at the CDN
    // root here.
    imageSrc: isWork ? (item?.id ?? '') : GetImageFromAnime(item),
    imagePath: isWork ? 'works' : '',
    // MyAnimeList's own host, used only if the cover has not reached the CDN.
    imageFallback: isWork && item?.image_url ? item.image_url : '/assets/not found.jpg',
    // Anime show a year alone; a work shows what kind of thing it is first,
    // because "Light novel" is the fact that distinguishes it from the anime
    // sitting a few rows above it under the same name.
    subtitle: isWork
      ? [readableWorkType(item?.type), getYearUTC(item?.published_from)].filter(Boolean).join(' · ')
      : getYearUTC(item?.start_date)
  };
}
