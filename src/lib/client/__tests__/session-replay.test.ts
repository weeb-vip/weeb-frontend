import { afterEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";
import {
  applySessionReplay,
  gateSessionReplay,
  isAuthFunnel,
  posthogRecorder,
  resetSessionReplayForTests,
  wantsReplay,
} from "../session-replay";

afterEach(() => {
  resetSessionReplayForTests();
  delete (window as any).posthog;
});

describe("wantsReplay", () => {
  it("records a signed-in user wherever they are", () => {
    expect(
      wantsReplay({ isLoggedIn: true, modalOpen: false, pathname: "/" }),
    ).toBe(true);
  });

  it("records the auth funnel: the modal, and the /auth pages", () => {
    expect(
      wantsReplay({ isLoggedIn: false, modalOpen: true, pathname: "/anime/x" }),
    ).toBe(true);
    expect(
      wantsReplay({
        isLoggedIn: false,
        modalOpen: false,
        pathname: "/auth/register",
      }),
    ).toBe(true);
    expect(
      wantsReplay({
        isLoggedIn: false,
        modalOpen: false,
        pathname: "/auth/verification",
      }),
    ).toBe(true);
  });

  it("does not record anonymous browsing", () => {
    expect(
      wantsReplay({ isLoggedIn: false, modalOpen: false, pathname: "/" }),
    ).toBe(false);
    expect(
      wantsReplay({
        isLoggedIn: false,
        modalOpen: false,
        pathname: "/search?q=auth",
      }),
    ).toBe(false);
    expect(
      wantsReplay({ isLoggedIn: false, modalOpen: false, pathname: "/author" }),
    ).toBe(false);
  });

  it("knows the funnel paths exactly", () => {
    expect(isAuthFunnel("/auth")).toBe(true);
    expect(isAuthFunnel("/auth/login")).toBe(true);
    expect(isAuthFunnel("/authors")).toBe(false);
  });
});

describe("gateSessionReplay", () => {
  const recorder = () => ({ start: vi.fn(), stop: vi.fn() });

  it("starts when the visitor signs in and stops when they sign out", () => {
    const gate = writable({
      isLoggedIn: false,
      modalOpen: false,
      pathname: "/",
    });
    const rec = recorder();
    gateSessionReplay(gate, rec);
    // Anonymous: nothing wanted, so the recorder is told to stop once (the
    // library starts wherever the project setting says; this makes it explicit).
    expect(rec.stop).toHaveBeenCalledTimes(1);
    expect(rec.start).not.toHaveBeenCalled();

    gate.set({ isLoggedIn: true, modalOpen: false, pathname: "/" });
    expect(rec.start).toHaveBeenCalledTimes(1);

    gate.set({ isLoggedIn: false, modalOpen: false, pathname: "/" });
    expect(rec.stop).toHaveBeenCalledTimes(2);
  });

  it("records the modal round-trip and nothing after it", () => {
    const gate = writable({
      isLoggedIn: false,
      modalOpen: false,
      pathname: "/anime/x",
    });
    const rec = recorder();
    gateSessionReplay(gate, rec);

    gate.set({ isLoggedIn: false, modalOpen: true, pathname: "/anime/x" });
    expect(rec.start).toHaveBeenCalledTimes(1);
    gate.set({ isLoggedIn: false, modalOpen: false, pathname: "/anime/x" });
    expect(rec.stop).toHaveBeenCalledTimes(2);
  });

  it("keeps one recording across a sign-up that lands signed in", () => {
    const gate = writable({
      isLoggedIn: false,
      modalOpen: false,
      pathname: "/auth/register",
    });
    const rec = recorder();
    gateSessionReplay(gate, rec);
    expect(rec.start).toHaveBeenCalledTimes(1);

    gate.set({ isLoggedIn: true, modalOpen: false, pathname: "/profile" });
    // Still wanted: no second start, no stop.
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.stop).not.toHaveBeenCalled();
  });

  it("is told once per change, not once per store tick", () => {
    const gate = writable({
      isLoggedIn: true,
      modalOpen: false,
      pathname: "/",
    });
    const rec = recorder();
    gateSessionReplay(gate, rec);
    gate.set({ isLoggedIn: true, modalOpen: false, pathname: "/search" });
    gate.set({ isLoggedIn: true, modalOpen: true, pathname: "/search" });
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it("stops following once unsubscribed", () => {
    const gate = writable({
      isLoggedIn: false,
      modalOpen: false,
      pathname: "/",
    });
    const rec = recorder();
    const stop = gateSessionReplay(gate, rec);
    stop();
    gate.set({ isLoggedIn: true, modalOpen: false, pathname: "/" });
    expect(rec.start).not.toHaveBeenCalled();
  });
});

describe("the PostHog recorder", () => {
  it("drives the real library when it is there", () => {
    const ph = {
      startSessionRecording: vi.fn(),
      stopSessionRecording: vi.fn(),
    };
    (window as any).posthog = ph;
    posthogRecorder.start();
    expect(ph.startSessionRecording).toHaveBeenCalledTimes(1);
    posthogRecorder.stop();
    expect(ph.stopSessionRecording).toHaveBeenCalledTimes(1);
  });

  it("remembers an ask made against the bootstrap stub and applies it when the library loads", () => {
    // The stub queues known methods only; the recording ones are not among them.
    (window as any).posthog = [];
    posthogRecorder.start();

    const ph = {
      startSessionRecording: vi.fn(),
      stopSessionRecording: vi.fn(),
    };
    applySessionReplay(ph);
    expect(ph.startSessionRecording).toHaveBeenCalledTimes(1);
    expect(ph.stopSessionRecording).not.toHaveBeenCalled();
  });

  it("applies nothing when nothing was asked", () => {
    const ph = {
      startSessionRecording: vi.fn(),
      stopSessionRecording: vi.fn(),
    };
    applySessionReplay(ph);
    expect(ph.startSessionRecording).not.toHaveBeenCalled();
    expect(ph.stopSessionRecording).not.toHaveBeenCalled();
  });
});
