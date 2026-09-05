import { describe, expect, test } from '@jest/globals';
import {
  CHARACTERS,
  EPISODES,
  NEWS,
  SYNOPSIS,
  activeSection,
  airingChip,
  allStudios,
  clampEpisodeCount,
  episodeTotal,
  firstStudio,
  heroImageSources,
  mergeUserAnime,
  nextEpisodeChip,
  resolveShow,
  scheduleLabel,
  sectionElementId,
  sectionScrollTop,
  sectionTabs,
  stickyStackHeight,
  tabBarTop,
  trackingInput,
  watchedNumbersFrom,
} from '../ShowContent.rules';

/** A settled query that answered with a record. */
const answered = (anime: any) => ({ data: { anime }, isLoading: false, isError: false });
const pending = { isLoading: true, isError: false };
const failed = { isLoading: false, isError: true };
const empty = { data: null, isLoading: false, isError: false };

describe('resolveShow — SSR versus the query', () => {
  test('renders the loader payload on the first frame, before the query answers', () => {
    const ssrAnime = { id: 'a', titleEn: 'Frieren' };

    const resolved = resolveShow({ animeData: { anime: ssrAnime }, error: null }, pending);

    expect(resolved.status).toBe('ready');
    expect(resolved.anime).toBe(ssrAnime);
  });

  test('the query supersedes the loader payload once it answers', () => {
    const resolved = resolveShow(
      { animeData: { anime: { id: 'a', ranking: 1 } }, error: null },
      answered({ id: 'a', ranking: 2 }),
    );

    expect(resolved.anime.ranking).toBe(2);
  });

  test('a loader error still renders as an error while the query is in flight', () => {
    expect(resolveShow({ animeData: null, error: 'gateway down' }, pending).status).toBe('error');
  });

  test('...but a successful client fetch clears it — the page recovers on hydration', () => {
    const resolved = resolveShow({ animeData: null, error: 'gateway down' }, answered({ id: 'a' }));

    expect(resolved.status).toBe('ready');
    expect(resolved.anime.id).toBe('a');
  });

  test('a failed query with no loader payload is an error', () => {
    expect(resolveShow({ animeData: null, error: null }, failed).status).toBe('error');
  });

  test('a query that settles with no anime at all is a failure, not an empty page', () => {
    expect(resolveShow({ animeData: null, error: null }, empty).status).toBe('error');
  });

  test('nothing yet, and nothing wrong, is loading', () => {
    expect(resolveShow({ animeData: null, error: null }, pending).status).toBe('loading');
  });

  test('a loader payload outranks a query error — a stale page beats a dead one', () => {
    const resolved = resolveShow({ animeData: { anime: { id: 'a' } }, error: null }, failed);

    expect(resolved.status).toBe('ready');
  });
});

describe('mergeUserAnime — keeping the viewer’s row', () => {
  test('carries the SSR row over when the client refetch came back without one', () => {
    // userAnime is authenticated, and a cold client fetch loses it for a beat.
    // Without this the show flickered from "Watching" to "Add to list".
    const merged = mergeUserAnime({ id: 'a' }, { id: 'a', userAnime: { status: 'WATCHING' } });

    expect(merged.userAnime).toEqual({ status: 'WATCHING' });
  });

  test('the query wins when it has a row of its own', () => {
    const merged = mergeUserAnime(
      { id: 'a', userAnime: { status: 'COMPLETED' } },
      { id: 'a', userAnime: { status: 'WATCHING' } },
    );

    expect(merged.userAnime.status).toBe('COMPLETED');
  });

  test('returns the same object when there is nothing to carry, so identity is stable', () => {
    const queryAnime = { id: 'a' };

    expect(mergeUserAnime(queryAnime, { id: 'a' })).toBe(queryAnime);
  });
});

describe('sectionTabs', () => {
  test('synopsis and characters always exist; news and episodes are earned', () => {
    const tabs = sectionTabs({ newsEnabled: true, newsCount: 0, episodeCount: 0 });

    expect(tabs.map((t) => t.value)).toEqual([SYNOPSIS, CHARACTERS]);
  });

  test('a populated show gets all four, in page order, with counts', () => {
    const tabs = sectionTabs({ newsEnabled: true, newsCount: 12, episodeCount: 28 });

    expect(tabs.map((t) => t.value)).toEqual([SYNOPSIS, NEWS, EPISODES, CHARACTERS]);
    expect(tabs[1].count).toBe(12);
    expect(tabs[2].count).toBe(28);
  });

  test('news stays hidden while the flag is off, however many stories there are', () => {
    const tabs = sectionTabs({ newsEnabled: false, newsCount: 12, episodeCount: 3 });

    expect(tabs.map((t) => t.value)).toEqual([SYNOPSIS, EPISODES, CHARACTERS]);
  });
});

describe('activeSection — the scroll spy', () => {
  const sections = [SYNOPSIS, NEWS, EPISODES, CHARACTERS];
  const tops = (map: Record<string, number | null>) => (section: string) => map[section] ?? null;

  test('nothing has crossed the line yet, so the first section is current', () => {
    expect(
      activeSection(sections, tops({ synopsis: 400, news: 900, episodes: 1400, characters: 2000 }), 220),
    ).toBe(SYNOPSIS);
  });

  test('the LOWEST section past the line wins, not the first', () => {
    // Several sections are above the threshold at once on the way down; only
    // the last of them is the one actually filling the viewport.
    expect(
      activeSection(sections, tops({ synopsis: -900, news: -400, episodes: 100, characters: 800 }), 220),
    ).toBe(EPISODES);
  });

  test('sections this show does not have are skipped rather than counted as at the top', () => {
    expect(
      activeSection(sections, tops({ synopsis: -900, news: null, episodes: null, characters: 100 }), 220),
    ).toBe(CHARACTERS);
  });

  test('an empty list still answers, so the tab strip never has nothing selected', () => {
    expect(activeSection([], () => null, 220)).toBe(SYNOPSIS);
  });

  test('the element id is derived from the section, so the spy and the nav agree', () => {
    expect(sectionElementId(EPISODES)).toBe('show-section-episodes');
  });
});

describe('the sticky stack', () => {
  test('the offset is the tab bar alone until the compact header shows', () => {
    expect(stickyStackHeight(false, 72, 41)).toBe(41);
    expect(stickyStackHeight(true, 72, 41)).toBe(113);
  });

  test('the tab bar sits one pixel back so the two borders do not double up', () => {
    expect(tabBarTop(true, 72)).toBe('calc(var(--weeb-nav-height, 60px) + 71px)');
    expect(tabBarTop(false, 72)).toBe('calc(var(--weeb-nav-height, 60px) + 0px)');
  });

  test('a bar measured at zero cannot produce a negative offset', () => {
    expect(tabBarTop(true, 0)).toBe('calc(var(--weeb-nav-height, 60px) + 0px)');
  });

  test('a section scroll clears the nav and the whole measured stack', () => {
    expect(sectionScrollTop(500, 1000, 60, 113)).toBe(1319);
  });

  test('never scrolls to a negative offset — the hero starts above the origin', () => {
    expect(sectionScrollTop(-2000, 0, 60, 113)).toBe(0);
  });
});

describe('tracking arithmetic', () => {
  test('a step is clamped to the show’s length', () => {
    expect(clampEpisodeCount(11, 1, 12)).toBe(12);
    expect(clampEpisodeCount(12, 1, 12)).toBe(12);
  });

  test('and never goes below zero', () => {
    expect(clampEpisodeCount(0, -1, 12)).toBe(0);
  });

  test('an unknown length has no ceiling, but still has a floor', () => {
    expect(clampEpisodeCount(900, 1, null)).toBe(901);
    expect(clampEpisodeCount(0, -1, null)).toBe(0);
  });

  test('the total prefers the recorded count, then the list, then nothing', () => {
    expect(episodeTotal({ episodeCount: 12, episodes: [1, 2] })).toBe(12);
    expect(episodeTotal({ episodes: [1, 2, 3] })).toBe(3);
    expect(episodeTotal({})).toBeNull();
  });

  test('a write carries the whole row, so a score edit cannot blank the status', () => {
    const anime = { id: 'a', userAnime: { status: 'WATCHING', score: 8, episodes: 4 } };

    expect(trackingInput(anime, { score: 9 })).toEqual({
      animeID: 'a',
      status: 'WATCHING',
      score: 9,
      episodes: 4,
    });
  });

  test('an episodes edit leaves the score alone', () => {
    const anime = { id: 'a', userAnime: { status: 'WATCHING', score: 8, episodes: 4 } };

    expect(trackingInput(anime, { episodes: 5 })).toMatchObject({ score: 8, episodes: 5 });
  });

  test('watched numbers are null until the query answers, not an empty set', () => {
    // An empty set would mean "nothing is watched", which draws every row
    // unwatched and invites a click that un-marks something.
    expect(watchedNumbersFrom(null)).toBeNull();
    expect(watchedNumbersFrom(undefined)).toBeNull();
    expect(watchedNumbersFrom([])).toEqual(new Set());
  });

  test('and are the episode numbers themselves, not a count', () => {
    expect(watchedNumbersFrom([{ episodeNumber: 1 }, { episodeNumber: 2 }, { episodeNumber: 5 }])).toEqual(
      new Set([1, 2, 5]),
    );
  });
});

describe('the schedule chip', () => {
  const base = { hasSchedule: true, live: false, aired: false, countdown: '', episodeNumber: '' };

  test('nothing scheduled means no chip at all', () => {
    expect(nextEpisodeChip({ ...base, hasSchedule: false, countdown: '3h' })).toBeNull();
  });

  test('airing right now beats everything else', () => {
    expect(nextEpisodeChip({ ...base, live: true, countdown: '12m left' })).toBe('NOW');
  });

  test('a countdown reads as a countdown', () => {
    expect(nextEpisodeChip({ ...base, countdown: '3h' })).toBe('Next in 3h');
  });

  test('the sentinel countdowns are not printed as durations', () => {
    // "Next in AIRING NOW" shipped once.
    expect(nextEpisodeChip({ ...base, countdown: 'AIRING NOW', episodeNumber: '7' })).toBe('Next: Ep 7');
  });

  test('just-aired says so rather than counting down to it', () => {
    expect(nextEpisodeChip({ ...base, aired: true, countdown: 'JUST AIRED' })).toBe('Just aired');
  });

  test('an episode further out than a day falls back to its number', () => {
    expect(nextEpisodeChip({ ...base, countdown: '', episodeNumber: '9' })).toBe('Next: Ep 9');
  });

  test('and to a bare "soon" when even the number is unknown', () => {
    expect(nextEpisodeChip(base)).toBe('Next soon');
  });

  test('the panel label follows the same three states', () => {
    expect(scheduleLabel(true, false)).toBe('Airing now');
    expect(scheduleLabel(false, true)).toBe('Recently aired');
    expect(scheduleLabel(false, false)).toBe('Next episode');
  });
});

describe('record shapes', () => {
  test('an unaired or ongoing show has no end date, and reads as airing', () => {
    expect(airingChip({ endDate: null })).toEqual({ label: 'Airing', airing: true });
    expect(airingChip({ endDate: '2024-03-22' })).toEqual({ label: 'Finished', airing: false });
  });

  test('studios arrive as an array from some sources and a bare string from others', () => {
    expect(firstStudio(['Madhouse', 'Bones'])).toBe('Madhouse');
    expect(firstStudio('Madhouse')).toBe('Madhouse');
    expect(firstStudio([])).toBeNull();
    expect(firstStudio(null)).toBeNull();
    expect(allStudios(['Madhouse', 'Bones'])).toBe('Madhouse, Bones');
  });

  test('hero art is the banner first, then the poster, both keyed by anime id', () => {
    const url = (id: string, path?: string) => (path ? `cdn/${path}/${id}` : `cdn/${id}`);

    expect(heroImageSources('a1', url)).toEqual(['cdn/banners/a1', 'cdn/a1']);
  });

  test('no id means no candidates, rather than a URL for nothing', () => {
    expect(heroImageSources(null, () => 'x')).toEqual([]);
  });
});
