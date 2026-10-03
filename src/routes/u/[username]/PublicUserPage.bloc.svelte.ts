import { fromStore, type Readable } from 'svelte/store';
import { configStore } from '$lib/stores/config';
import { workSubtitle } from '$lib/utils/workDisplay';
import { accentValue } from '$lib/utils/accents';
import type { MediaListCard } from '$lib/components/profile/MediaList.bloc.svelte';
import { toActivityItems, type ActivityItem } from '$lib/components/feed/activity';
import type { FollowTarget } from '$lib/components/profile/FollowButton/FollowButton.bloc.svelte';

/**
 * Someone else's profile, at /u/<username>.
 *
 * The header is always public; the lists arrive only when the viewed user opted
 * them in, which the server decides -- a private profile reaches this with no
 * list data attached at all, so the gate is not in the markup.
 */

/** Just the CDN base, which is all this page needs the config for. */
export type ConfigPort = Readable<{ cdn_user_url?: string } | null | undefined>;

/** What the view knows: the loader's user row and its lists, if any. */
export type PublicUserSource = () => { user: any; lists: any; activity?: any; followInfo?: any };

export interface PublicUserPageDeps {
  source?: PublicUserSource;
  config?: ConfigPort;
  /** The clock for relative times in the activity list; a port so tests are stable. */
  now?: () => number;
}

export interface PublicUserStat {
  label: string;
  value: number;
}

export interface PublicUserCard extends MediaListCard {
  key: string;
}

/**
 * The count fields are Int64 scalars, which arrive over JSON as strings -- so
 * they are coerced before any arithmetic, or the sum would concatenate
 * ("0" + "1" + "2" -> "012") instead of adding.
 */
const num = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export class PublicUserPageBloc {
  readonly #source: PublicUserSource;
  readonly #config: { readonly current: { cdn_user_url?: string } | null | undefined };
  readonly #now: () => number;
  /** Follower count moved by this session's own follow/unfollow, per user. */
  #followerDelta = $state<{ userID: string; delta: number }>({ userID: '', delta: 0 });

  constructor({ source = () => ({ user: null, lists: null }), config = configStore, now = () => Date.now() }: PublicUserPageDeps = {}) {
    this.#source = source;
    this.#config = fromStore(config);
    this.#now = now;
  }

  get user(): any {
    return this.#source().user;
  }

  get username(): string {
    return this.user?.username ?? '';
  }

  get displayName(): string {
    const user = this.user;
    return (
      [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() || user?.username || 'User'
    );
  }

  get initials(): string {
    const user = this.user;
    return ((user?.firstname?.[0] || user?.username?.[0] || '?') + (user?.lastname?.[0] || '')).toUpperCase();
  }

  get bio(): string {
    return this.user?.bio ?? '';
  }

  /**
   * The accent they picked, applied as --weeb-accent over this page's subtree,
   * so their choice tints exactly the header and the counts and nothing global.
   */
  get accentStyle(): string {
    const accent = accentValue(this.user?.accentColor);
    return accent ? `--weeb-accent: ${accent};` : '';
  }

  /**
   * cdn_user_url comes from the hydrated config, so these recompute once the
   * root layout populates the store -- the staging fallback only ever shows for
   * the instant before hydration, and matches staging anyway.
   */
  get #cdnBase(): string {
    return this.#config.current?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging';
  }

  get bannerUrl(): string | null {
    const name = this.user?.bannerImageUrl;
    return name ? `${this.#cdnBase}/${name}` : null;
  }

  get avatarUrl(): string | null {
    const name = this.user?.profileImageUrl;
    return name ? `${this.#cdnBase}/${name}` : null;
  }

  get isPublic(): boolean {
    return !!this.user?.listsPublic;
  }

  get watching(): PublicUserCard[] {
    const rows = this.#source().lists?.watching?.animes ?? [];
    return rows.map((entry: any) => ({
      key: String(entry.id),
      id: entry.anime?.id ?? '',
      slug: entry.anime?.slug,
      title: entry.anime?.titleEn || entry.anime?.titleJp || 'Untitled',
      image: entry.anime?.id ?? '',
      status: entry.anime?.animeStatus ?? null,
      sub: entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : '',
      genres: entry.anime?.tags ?? [],
      description: entry.anime?.description ?? '',
      episodeCount: entry.anime?.episodeCount,
      onList: entry.status ?? 'watching',
    }));
  }

  get reading(): PublicUserCard[] {
    const rows = this.#source().lists?.reading?.works ?? [];
    return rows.map((entry: any) => ({
      key: String(entry.id),
      id: entry.work?.id ?? '',
      title: entry.work?.titleEn || entry.work?.titleJp || 'Untitled',
      image: entry.work?.id ?? '',
      imagePath: 'works',
      score: entry.work?.score ?? null,
      sub: workSubtitle(entry.work?.type, entry.work?.publishedFrom),
      href: entry.work?.urlSlug ? `/manga/${entry.work.urlSlug}` : '/search',
      onList: entry.status ?? 'reading',
    }));
  }

  /** The header's numbers. Empty while the lists are private -- so is the header. */
  get stats(): PublicUserStat[] {
    if (!this.isPublic) return [];
    const lists = this.#source().lists;
    const anime = lists?.animeCounts ?? null;
    const work = lists?.workCounts ?? null;
    const sum = (counts: any, keys: string[]) =>
      counts ? keys.reduce((total, key) => total + num(counts[key]), 0) : 0;
    const tracked =
      sum(anime, ['watching', 'planToWatch', 'completed', 'onHold', 'dropped']) +
      sum(work, ['reading', 'planToRead', 'completed', 'onHold', 'dropped']);

    return [
      { label: 'Tracked', value: tracked },
      { label: 'Watching', value: num(anime?.watching) },
      { label: 'Anime done', value: num(anime?.completed) },
      { label: 'Reading', value: num(work?.reading) },
      { label: 'Manga done', value: num(work?.completed) },
    ];
  }

  // ── follow graph ────────────────────────────────────────────

  get #followInfo(): any {
    return this.#source().followInfo ?? null;
  }

  /** False when the follow API answered nothing; the page then shows no follow UI. */
  get hasFollowInfo(): boolean {
    return !!this.#followInfo;
  }

  /** What the Follow button needs: who, and how the viewer stands with them. */
  get followTarget(): FollowTarget {
    const user = this.user;
    const info = this.#followInfo;
    return {
      userID: user?.id ?? '',
      username: user?.username ?? '',
      status: info?.viewerFollowStatus ?? 'NONE',
      followApprovalRequired: !!info?.followApprovalRequired,
    };
  }

  get followerCount(): number {
    const base = num(this.#followInfo?.followerCount);
    const delta = this.#followerDelta.userID === (this.user?.id ?? '') ? this.#followerDelta.delta : 0;
    return Math.max(0, base + delta);
  }

  get followingCount(): number {
    return num(this.#followInfo?.followingCount);
  }

  /** False when notifications-service answered nothing; the section is hidden. */
  get hasActivity(): boolean {
    return this.isPublic && this.#source().activity != null;
  }

  /** The Follow button reports its own effect so the tile moves at once. */
  adjustFollowers(delta: number): void {
    const userID = this.user?.id ?? '';
    const current = this.#followerDelta.userID === userID ? this.#followerDelta.delta : 0;
    this.#followerDelta = { userID, delta: current + delta };
  }

  get followersHref(): string {
    return `/u/${encodeURIComponent(this.username)}/followers`;
  }

  get followingHref(): string {
    return `/u/${encodeURIComponent(this.username)}/following`;
  }

  // ── activity ────────────────────────────────────────────────

  get activity(): ActivityItem[] {
    if (!this.isPublic) return [];
    return toActivityItems(this.#source().activity?.activities, this.#now());
  }
}
