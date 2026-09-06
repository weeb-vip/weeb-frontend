import { describe, it, expect, vi } from 'vitest';
import {
  GlobalToasterBloc,
  MOBILE_QUERY,
  fixedViewport,
  mediaQueryViewport
} from './GlobalToaster.bloc.svelte';

describe('GlobalToasterBloc', () => {
  it('starts in the desktop corner, which is what SSR renders', () => {
    const bloc = new GlobalToasterBloc({ viewport: fixedViewport(true) });

    // Before anything has watched the viewport.
    expect(bloc.isMobile).toBe(false);
    expect(bloc.position).toBe('top-right');
  });

  it('moves the stack to the top centre on a narrow viewport', () => {
    const bloc = new GlobalToasterBloc({ viewport: fixedViewport(true) });

    bloc.watchViewport();

    // A 22rem card pinned right either overflows or crowds the edge.
    expect(bloc.isMobile).toBe(true);
    expect(bloc.position).toBe('top-center');
  });

  it('stays in the corner on a wide viewport', () => {
    const bloc = new GlobalToasterBloc({ viewport: fixedViewport(false) });

    bloc.watchViewport();

    expect(bloc.position).toBe('top-right');
  });

  it('follows the viewport across the breakpoint, both ways', () => {
    let report!: (matches: boolean) => void;
    const bloc = new GlobalToasterBloc({
      viewport: {
        watch(onChange) {
          report = onChange;
          onChange(false);
          return () => {};
        }
      }
    });
    bloc.watchViewport();

    report(true);
    expect(bloc.position).toBe('top-center');

    report(false);
    expect(bloc.position).toBe('top-right');
  });

  it('hands its teardown back for the view’s effect', () => {
    const stop = vi.fn();
    const bloc = new GlobalToasterBloc({ viewport: { watch: () => stop } });

    bloc.watchViewport()();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('mediaQueryViewport', () => {
  it('asks the browser the mobile question once, rather than on every resize frame', () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn((query: string) => ({
      matches: query === MOBILE_QUERY,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
      removeEventListener
    }));
    vi.stubGlobal('matchMedia', matchMedia);

    const onChange = vi.fn();
    const stop = mediaQueryViewport().watch(onChange);

    expect(matchMedia).toHaveBeenCalledWith(MOBILE_QUERY);
    // Reports the current answer immediately, so the first render is right.
    expect(onChange).toHaveBeenCalledWith(true);

    listeners[0]({ matches: false });
    expect(onChange).toHaveBeenLastCalledWith(false);

    stop();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('is inert where there is no matchMedia to ask -- an SSR render', () => {
    vi.stubGlobal('matchMedia', undefined);
    const onChange = vi.fn();

    const stop = mediaQueryViewport().watch(onChange);

    expect(onChange).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('fixedViewport', () => {
  it('pins the answer and never changes it', () => {
    const onChange = vi.fn();

    const stop = fixedViewport(true).watch(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(() => stop()).not.toThrow();
  });
});
