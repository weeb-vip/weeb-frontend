/**
 * Turns feed rows from the API into what a feed item renders. Pure, so the
 * wording and the time formatting can be tested without a component.
 */

/** How many activities a page of /feed shows; the loader and the client agree. */
export const FEED_PAGE_SIZE = 24;

export interface ActivityActor {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
}

export interface ActivityItem {
  key: string;
  actor: ActivityActor;
  /** "started watching", "scored 8.5", ... -- the sentence after the name. */
  verb: string;
  /** The poster card for the title the activity is about. */
  card: {
    id: string;
    slug?: string | null;
    title: string;
    image: string;
    imagePath: 'posters' | 'works';
    href?: string;
    onList?: string | null;
  };
  occurredAt: string;
  when: string;
}

const ANIME_STATUS_VERBS: Record<string, string> = {
  WATCHING: 'started watching',
  COMPLETED: 'finished watching',
  ONHOLD: 'put on hold',
  DROPPED: 'dropped',
  PLANTOWATCH: 'plans to watch',
};

const WORK_STATUS_VERBS: Record<string, string> = {
  READING: 'started reading',
  COMPLETED: 'finished reading',
  ONHOLD: 'put on hold',
  DROPPED: 'dropped',
  PLANTOREAD: 'plans to read',
};

const ANIME_ADD_VERBS: Record<string, string> = {
  WATCHING: 'started watching',
  COMPLETED: 'has watched',
  PLANTOWATCH: 'plans to watch',
  ONHOLD: 'put on hold',
  DROPPED: 'dropped',
};

const WORK_ADD_VERBS: Record<string, string> = {
  READING: 'started reading',
  COMPLETED: 'has read',
  PLANTOREAD: 'plans to read',
  ONHOLD: 'put on hold',
  DROPPED: 'dropped',
};

function statusKey(status: unknown): string {
  return String(status ?? '').toUpperCase();
}

function formatScore(score: unknown): string {
  const n = Number(score);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** The sentence after the actor's name. */
export function describeActivity(activity: any): string {
  const type = String(activity?.type ?? '');
  const status = statusKey(activity?.status);
  switch (type) {
    case 'ANIME_ADDED':
      return ANIME_ADD_VERBS[status] ?? 'added to their list';
    case 'ANIME_STATUS_CHANGED':
      return ANIME_STATUS_VERBS[status] ?? 'updated';
    case 'ANIME_SCORED':
    case 'WORK_SCORED': {
      const score = formatScore(activity?.score);
      return score ? `scored ${score}` : 'rated';
    }
    case 'WORK_ADDED':
      return WORK_ADD_VERBS[status] ?? 'added to their list';
    case 'WORK_STATUS_CHANGED':
      return WORK_STATUS_VERBS[status] ?? 'updated';
    default:
      return 'updated';
  }
}

/** "just now", "5m", "3h", "2d", or the date once it is more than a week old. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function actorOf(actor: any): ActivityActor {
  const username = actor?.username || 'someone';
  const name = [actor?.firstname, actor?.lastname].filter(Boolean).join(' ').trim() || username;
  return { id: actor?.id ?? '', username, name, profileImageUrl: actor?.profileImageUrl ?? null };
}

export function toActivityItems(rows: any[] | null | undefined, now: number = Date.now()): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const row of rows ?? []) {
    const anime = row?.anime;
    const work = row?.work;
    if (!anime && !work) continue;
    const card = anime
      ? {
          id: anime.id ?? '',
          slug: anime.slug ?? null,
          title: anime.titleEn || anime.titleJp || 'Untitled',
          image: anime.id ?? '',
          imagePath: 'posters' as const,
          onList: row.status ?? null,
        }
      : {
          id: work.id ?? '',
          title: work.titleEn || work.titleJp || 'Untitled',
          image: work.id ?? '',
          imagePath: 'works' as const,
          href: work.urlSlug ? `/manga/${work.urlSlug}` : '/search',
          onList: row.status ?? null,
        };
    items.push({
      key: String(row.id),
      actor: actorOf(row.actor),
      verb: describeActivity(row),
      card,
      occurredAt: row.occurredAt ?? '',
      when: relativeTime(row.occurredAt ?? '', now),
    });
  }
  return items;
}
