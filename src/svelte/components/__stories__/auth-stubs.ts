import { readable } from 'svelte/store';
import { ResendBloc, type TimerPort } from '../auth-resend.svelte';
import type { RoutePort } from '../auth-shared';

/**
 * The stubs every auth story injects. They live here rather than in each story
 * file for the same reason the ports exist at all: seven copies of "an auth
 * call that never resolves" is seven chances for one of them to mean something
 * slightly different.
 */

/** The query string a screen was opened with. */
export function routeWith(query = ''): RoutePort {
  return readable(new URLSearchParams(query));
}

/** A clock that never fires, so a countdown holds still to be looked at. */
export const frozenClock: TimerPort = {
  start: () => 1,
  stop: () => {}
};

/** In flight forever: the story stays on the submitting frame. */
export const pending = () => new Promise<never>(() => {});

/** A call that fails with a message a story can assert its wording against. */
export function failsWith(message: string) {
  return async (): Promise<never> => {
    throw new Error(message);
  };
}

export type ResendStoryState = 'idle' | 'sending' | 'sent' | 'failed' | 'cooling';

/**
 * The send behind one of those states, for a story that has to trigger the
 * resend itself -- the login form clears its banner on submit, so its stories
 * resend after submitting rather than arriving pre-sent.
 */
export function resendPort(state: ResendStoryState) {
  if (state === 'sending') return pending;
  if (state === 'failed') return failsWith('rate limited');
  return async () => true;
}

/**
 * A `ResendBloc` already in one of its states. `sending` never settles and
 * `cooling` is frozen at the top of its minute -- both so the frame stays put.
 */
export function resendIn(state: ResendStoryState): ResendBloc {
  if (state === 'idle') {
    return new ResendBloc({ send: async () => true, timer: frozenClock });
  }

  const bloc = new ResendBloc({
    send: state === 'sending' ? pending : state === 'failed' ? failsWith('rate limited') : async () => true,
    timer: frozenClock,
    cooldownSeconds: state === 'cooling' ? 60 : 0
  });

  void bloc.resend('kaori@example.com');
  return bloc;
}
