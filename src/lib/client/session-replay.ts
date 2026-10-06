import type { Readable } from "svelte/store";

/**
 * Session replay is reserved for the people we can learn the most from: a
 * signed-in user, and a visitor in the sign-up / sign-in funnel (the auth
 * modal, or any /auth page). Anonymous browsing is not recorded: PostHog is
 * initialised with `disable_session_recording`, and this gate turns the
 * recorder on and off from the client state.
 *
 * Stopping when nothing wants it is deliberate: a visitor who opened the modal
 * and closed it again is recorded for exactly that, not for the next hour of
 * browsing. PostHog stitches the segments of one session into one replay.
 */
export interface ReplayGate {
  isLoggedIn: boolean;
  /** The login/register modal is open. */
  modalOpen: boolean;
  pathname: string;
}

/** What drives the recorder: PostHog's two methods, or a stub in tests. */
export interface Recorder {
  start(): void;
  stop(): void;
}

export function isAuthFunnel(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

export function wantsReplay({
  isLoggedIn,
  modalOpen,
  pathname,
}: ReplayGate): boolean {
  return isLoggedIn || modalOpen || isAuthFunnel(pathname);
}

/**
 * The recorder's state as last asked for, kept here because the PostHog
 * bootstrap stub has neither `startSessionRecording` nor `stopSessionRecording`:
 * a call before `array.js` has loaded would be lost, so `applySessionReplay`
 * replays the last ask once the real library is in (`loaded` in global-ui).
 */
let desired: boolean | null = null;

export const posthogRecorder: Recorder = {
  start: () => {
    desired = true;
    applySessionReplay((window as any).posthog);
  },
  stop: () => {
    desired = false;
    applySessionReplay((window as any).posthog);
  },
};

/** Push the last ask onto a PostHog instance, if it is the real one. */
export function applySessionReplay(ph: any): void {
  if (desired === null || !ph) return;
  const method = desired ? ph.startSessionRecording : ph.stopSessionRecording;
  if (typeof method === "function") method.call(ph);
}

/** Test seam. */
export function resetSessionReplayForTests(): void {
  desired = null;
}

/**
 * Follows the gate and drives the recorder, once per change of answer. Returns
 * the unsubscribe; the layout holds it for its lifetime.
 */
export function gateSessionReplay(
  gate: Readable<ReplayGate>,
  recorder: Recorder = posthogRecorder,
): () => void {
  let recording: boolean | null = null;
  return gate.subscribe((state) => {
    const wanted = wantsReplay(state);
    if (wanted === recording) return;
    recording = wanted;
    if (wanted) recorder.start();
    else recorder.stop();
  });
}
