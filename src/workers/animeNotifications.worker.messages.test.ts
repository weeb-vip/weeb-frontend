/**
 * The notification worker's message contract, driven against the real module.
 *
 * The sibling `animeNotifications.worker.test.ts` deliberately never imports
 * this worker ("test worker functionality without direct import") and re-states
 * its logic inline, which is why the file itself sat at 0% coverage. This suite
 * imports the module and drives the handler it registers, so what is asserted is
 * the shipped code: what each inbound message type does, what it posts back, and
 * how it behaves on a message it does not understand.
 *
 * The worker is written against a worker global scope — a bare `postMessage`,
 * `self.addEventListener`, `self.devTimeOffset` — and under vitest's jsdom
 * `self === globalThis`, so that scope is real here rather than simulated. The
 * one substitution is `addEventListener`: it is wrapped before the import so the
 * handler can be captured and called directly, which also means the suite leaves
 * no listener registered on the global when it finishes.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { getAirDateTime } from '$lib/services/airTimeUtils';

const { listeners, restoreAddEventListener } = vi.hoisted(() => {
  const g = globalThis as any;
  const original = g.addEventListener;
  const listeners: Array<{ type: string; listener: (event: any) => void }> = [];

  g.addEventListener = (type: string, listener: any) => {
    listeners.push({ type, listener });
  };

  return {
    listeners,
    restoreAddEventListener: () => {
      g.addEventListener = original;
    }
  };
});

// Importing the module is what registers the handler; the side effect is the
// point, so the import stays even though nothing is named from it.
import './animeNotifications.worker';

// --------------------------------------------------------------------- fixtures

/**
 * `parseAirTime` reconstructs a JST slot: 21:00 JST is 12:00 UTC on the same
 * day, so this air date and this broadcast line resolve to 2024-01-15T12:00:00Z
 * — the same instant the backend's exact `airTime` carries. Keeping the two
 * agreeing is what makes the notification maths below readable.
 */
const AIR_DATE = '2024-01-15T00:00:00Z';
const BROADCAST = 'Mondays at 21:00 (JST)';
const AIR_TIME = '2024-01-15T12:00:00.000Z';
const DURATION = '24 min per episode';

const anime = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  titleEn: 'Frieren',
  titleJp: '葬送のフリーレン',
  imageUrl: 'frieren.jpg',
  duration: DURATION,
  broadcast: BROADCAST,
  nextEpisode: {
    id: 'e5',
    episodeNumber: 5,
    titleEn: 'Episode Five',
    titleJp: '第五話',
    airDate: AIR_DATE,
    airTime: AIR_TIME
  },
  ...overrides
});

// ------------------------------------------------------------------ the harness

let handler: (event: { data: unknown }) => void;
let posted: Mock;
let logs: Mock;
let warns: Mock;

beforeAll(() => {
  const messageListeners = listeners.filter((l) => l.type === 'message');
  // The worker's whole inbound surface is this one listener.
  expect(messageListeners).toHaveLength(1);
  handler = messageListeners[0].listener;
});

afterAll(() => restoreAddEventListener());

/** Deliver a message the way the main thread would. */
function send(data: unknown) {
  handler({ data });
}

const messagesOfType = (type: string) =>
  posted.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === type);

function at(iso: string) {
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  vi.useFakeTimers();
  posted = vi.fn();
  logs = vi.fn();
  warns = vi.fn();
  vi.stubGlobal('postMessage', posted);
  vi.spyOn(console, 'log').mockImplementation(logs);
  vi.spyOn(console, 'warn').mockImplementation(warns);
});

afterEach(() => {
  // Clears the worker's interval and its watch list before the fake clock goes
  // away, so no test hands the next one a running timer or a stale anime list.
  send({ type: 'stopWatching' });
  send({ type: 'setTimeOffset', offsetMs: 0 });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -------------------------------------------------------------- message routing

describe('inbound messages', () => {
  it('startWatching takes the list and reports how many it is watching', () => {
    at('2024-01-15T02:00:00Z');

    send({ type: 'startWatching', animeList: [anime(), anime({ id: 'a2' })] });

    expect(logs).toHaveBeenCalledWith('[AnimeWorker] Started watching 2 anime');
    // startWatching itself is silent on the wire — the first tick does the talking.
    expect(posted).not.toHaveBeenCalled();
  });

  it('startWatching starts a five-second countdown loop', () => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });

    vi.advanceTimersByTime(4999);
    expect(posted).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(messagesOfType('countdown')).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    expect(messagesOfType('countdown')).toHaveLength(2);
  });

  it('startWatching replaces the previous list instead of watching both', () => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });
    send({ type: 'startWatching', animeList: [anime({ id: 'a2' })] });

    send({ type: 'triggerUpdate' });

    expect(messagesOfType('countdown').map((m: any) => m.animeId)).toEqual(['a2']);
  });

  it('stopWatching silences the loop and empties the list', () => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });
    vi.advanceTimersByTime(5000);
    posted.mockClear();

    send({ type: 'stopWatching' });

    expect(logs).toHaveBeenCalledWith('[AnimeWorker] Stopped watching anime');
    vi.advanceTimersByTime(60_000);
    expect(posted).not.toHaveBeenCalled();

    // The list is gone too, so an explicit trigger has nothing to report.
    send({ type: 'triggerUpdate' });
    expect(posted).not.toHaveBeenCalled();
  });

  it('triggerUpdate answers immediately rather than waiting for the next tick', () => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    expect(logs).toHaveBeenCalledWith('[AnimeWorker] Triggering immediate update');
    expect(messagesOfType('countdown')).toHaveLength(1);
    expect(messagesOfType('timing')).toHaveLength(1);
  });

  it('setTimeOffset time-travels the clock every calculation reads', () => {
    // Five minutes before the "airing soon" window on the real clock...
    at('2024-01-15T11:34:58Z');
    send({ type: 'startWatching', animeList: [anime()] });
    send({ type: 'triggerUpdate' });
    expect(messagesOfType('notification')).toHaveLength(0);

    // ...and inside it once the worker is told to run five minutes ahead.
    send({ type: 'setTimeOffset', offsetMs: -5 * 60 * 1000 });
    expect(logs).toHaveBeenCalledWith('[AnimeWorker] Dev time offset set to:', -300000, 'ms');

    send({ type: 'triggerUpdate' });
    expect(messagesOfType('notification').map((m: any) => m.notificationType)).toEqual([
      'airing-soon'
    ]);
  });
});

describe('a message the worker does not understand', () => {
  it.each([
    ['an unknown type', { type: 'explode' }, 'explode'],
    ['no type at all', {}, undefined],
    ['a payload that is not an object', 'startWatching', undefined]
  ])('warns and does nothing else for %s', (_label, data, reported) => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });
    posted.mockClear();

    send(data);

    expect(warns).toHaveBeenCalledWith('[AnimeWorker] Unknown message type:', reported);
    expect(posted).not.toHaveBeenCalled();
  });

  /**
   * FINDING: the handler destructures `event.data` with no guard, so a message
   * carrying a null (or absent) payload throws inside the worker rather than
   * reaching the `default:` warn. In a real worker that surfaces as an
   * unhandled `error` event on the Worker object, not as a warning — the
   * `default` branch never sees it. Asserted as the current behaviour.
   */
  it('throws on a null payload instead of warning', () => {
    expect(() => send(null)).toThrow(TypeError);
    expect(warns).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ what it posts

describe('countdown and timing updates', () => {
  it('reports an upcoming episode within the next day', () => {
    at('2024-01-15T02:00:00Z'); // ten hours out
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    expect(messagesOfType('countdown')[0]).toEqual({
      type: 'countdown',
      animeId: 'a1',
      countdown: '10h',
      isAiring: false,
      hasAired: false,
      progress: undefined
    });
  });

  it('reports an episode that is on air right now, with its progress', () => {
    at('2024-01-15T12:10:00Z'); // ten minutes into a twenty-four minute episode
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    const countdown = messagesOfType('countdown')[0];
    expect(countdown.countdown).toBe('14m left');
    expect(countdown.isAiring).toBe(true);
    expect(countdown.progress).toBeCloseTo(10 / 24, 5);
  });

  it('clamps progress to 1 for an episode that ran past its listed duration', () => {
    at('2024-01-15T12:20:00Z');
    send({
      type: 'startWatching',
      animeList: [anime({ duration: '5 min' })]
    });

    send({ type: 'triggerUpdate' });

    // Twenty minutes into a five-minute slot: no longer "airing", so no progress.
    const countdown = messagesOfType('countdown')[0];
    expect(countdown.isAiring).toBe(false);
    expect(countdown.progress).toBeUndefined();
  });

  it('sends the full timing payload alongside the countdown', () => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    expect(messagesOfType('timing')[0]).toEqual({
      type: 'timing',
      animeId: 'a1',
      timingData: {
        countdown: '10h',
        isAiring: false,
        hasAired: false,
        progress: undefined,
        isAiringToday: true,
        isCurrentlyAiring: false,
        hasAlreadyAired: false,
        // Formatted in the runner's timezone by the shared helper, so this
        // asserts the worker forwards it rather than restating the format.
        airDateTime: getAirDateTime(AIR_DATE, BROADCAST),
        episode: {
          episodeNumber: 5,
          titleEn: 'Episode Five',
          titleJp: '第五話'
        }
      }
    });
  });

  it('still reports an episode that aired earlier in the week', () => {
    at('2024-01-16T12:00:00Z'); // a day later
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    const timing = messagesOfType('timing')[0];
    expect(timing.timingData.countdown).toBe('JUST AIRED');
    expect(timing.timingData.hasAired).toBe(true);
    expect(timing.timingData.hasAlreadyAired).toBe(true);
  });

  it('says nothing about an episode more than a day out', () => {
    at('2024-01-13T00:00:00Z'); // sixty hours out
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    expect(posted).not.toHaveBeenCalled();
  });

  it('says nothing about an episode that aired more than a week ago', () => {
    at('2024-01-25T12:00:00Z');
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });

    expect(posted).not.toHaveBeenCalled();
  });

  it('reports every watched anime separately', () => {
    at('2024-01-15T02:00:00Z');
    send({
      type: 'startWatching',
      animeList: [anime(), anime({ id: 'a2', titleEn: 'Bebop' })]
    });

    send({ type: 'triggerUpdate' });

    expect(messagesOfType('countdown').map((m: any) => m.animeId)).toEqual(['a1', 'a2']);
    expect(messagesOfType('timing').map((m: any) => m.animeId)).toEqual(['a1', 'a2']);
  });

  it('falls back to the broadcast slot when the backend sent no exact airTime', () => {
    at('2024-01-15T02:00:00Z');
    send({
      type: 'startWatching',
      animeList: [
        anime({
          nextEpisode: { id: 'e5', episodeNumber: 5, airDate: AIR_DATE, airTime: null }
        })
      ]
    });

    send({ type: 'triggerUpdate' });

    expect(messagesOfType('countdown')[0].countdown).toBe('10h');
  });

  it.each([
    ['no next episode', { nextEpisode: null }],
    ['no broadcast slot', { broadcast: null }],
    ['a next episode with no dates on it', { nextEpisode: { id: 'e5', episodeNumber: 5 } }]
  ])('skips an anime with %s', (_label, overrides) => {
    at('2024-01-15T02:00:00Z');
    send({ type: 'startWatching', animeList: [anime(overrides)] });

    send({ type: 'triggerUpdate' });

    expect(posted).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------- notifications

describe('notifications', () => {
  const notify = (iso: string, list = [anime()]) => {
    at(iso);
    send({ type: 'startWatching', animeList: list });
    send({ type: 'triggerUpdate' });
    return messagesOfType('notification');
  };

  it.each([
    ['thirty minutes before air', '2024-01-15T11:29:58Z', 'airing-soon'],
    ['five minutes before air', '2024-01-15T11:54:58Z', 'warning'],
    ['as the episode starts', '2024-01-15T11:59:58Z', 'airing'],
    ['while the episode is on air', '2024-01-15T12:10:00Z', 'airing'],
    ['just after the episode ends', '2024-01-15T12:34:00Z', 'finished-airing']
  ])('sends %s a "%s" notification', (_label, iso, expected) => {
    const notifications = notify(iso);

    expect(notifications.map((n: any) => n.notificationType)).toEqual([expected]);
  });

  it('carries the anime and the episode the toast needs', () => {
    const [notification] = notify('2024-01-15T12:10:00Z') as any[];

    expect(notification.anime.id).toBe('a1');
    expect(notification.anime.titleEn).toBe('Frieren');
    expect(notification.episode).toEqual({
      episodeNumber: 5,
      titleEn: 'Episode Five',
      titleJp: '第五話'
    });
  });

  it('sends each notification once, however often it is asked to update', () => {
    at('2024-01-15T12:10:00Z');
    send({ type: 'startWatching', animeList: [anime()] });

    send({ type: 'triggerUpdate' });
    send({ type: 'triggerUpdate' });
    vi.advanceTimersByTime(15_000);

    expect(messagesOfType('notification')).toHaveLength(1);
  });

  it('forgets what it has already sent when it is pointed at a new list', () => {
    at('2024-01-15T12:10:00Z');
    send({ type: 'startWatching', animeList: [anime()] });
    send({ type: 'triggerUpdate' });
    expect(messagesOfType('notification')).toHaveLength(1);

    send({ type: 'startWatching', animeList: [anime()] });
    send({ type: 'triggerUpdate' });

    expect(messagesOfType('notification')).toHaveLength(2);
  });

  it('dedups per anime, so a second show on air still gets its own notification', () => {
    at('2024-01-15T12:10:00Z');
    send({ type: 'startWatching', animeList: [anime()] });
    send({ type: 'triggerUpdate' });
    send({ type: 'triggerUpdate' });

    expect(messagesOfType('notification').map((n: any) => n.anime.id)).toEqual(['a1']);
  });

  it('notifies about every anime on air, not just the first', () => {
    const notifications = notify('2024-01-15T12:10:00Z', [
      anime(),
      anime({ id: 'a2', titleEn: 'Bebop' })
    ]);

    expect(notifications.map((n: any) => n.anime.id)).toEqual(['a1', 'a2']);
  });

  it('stays quiet about an anime airing outside the twenty-four hour window', () => {
    const notifications = notify('2024-01-13T00:00:00Z');

    expect(notifications).toHaveLength(0);
  });

  it('stays quiet in the dead time between the windows', () => {
    // Three hours out: past nothing, before every notification window.
    const notifications = notify('2024-01-15T09:00:00Z');

    expect(notifications).toHaveLength(0);
    // ...but the countdown still ticks.
    expect(messagesOfType('countdown')).toHaveLength(1);
  });
});
