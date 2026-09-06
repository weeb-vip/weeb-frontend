/**
 * `PerformanceMonitor` records durations and mirrors them into the User Timing
 * API. Two things are worth holding still: the numbers it hands back (and the
 * shape of `getMetrics()`, which callers read as a plain object), and that
 * every path degrades to a no-op rather than a throw when the platform has no
 * `performance` — which is exactly what happens under SSR and in the worker
 * builds that import this module transitively.
 *
 * What is stubbed, and what that costs:
 *   - `performance` itself is replaced with `undefined` for the absent-API
 *     tests. That proves the guards, and nothing more.
 *   - `PerformanceObserver` is replaced with a fake whose callback this file
 *     fires by hand. jsdom paints nothing, so no LCP entry can ever arrive on
 *     its own; whether the real observer sees a sensible largest-contentful
 *     -paint is a browser fact and belongs in Playwright/Lighthouse.
 *   - `getEntriesByName` / `getEntriesByType` are stubbed for the Web Vitals
 *     reads, because jsdom records no paint and no navigation timing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceMonitor, perf, usePerformanceMonitor } from '$lib/utils/performance';

/**
 * A realistic clock base. `measure()` guards with `if (!startTime)`, so a mark
 * taken at exactly epoch 0 reads as "never marked" — see the test that pins
 * that quirk down. Fake time therefore starts somewhere real.
 */
const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();

/** A PerformanceObserver that records nothing, for the paint tests that only care about FCP. */
class InertObserver {
  observe(): void {}
  disconnect(): void {}
}

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the singleton', () => {
  it('hands out one shared instance', () => {
    expect(PerformanceMonitor.getInstance()).toBe(PerformanceMonitor.getInstance());
    expect(perf).toBe(PerformanceMonitor.getInstance());
  });

  it('is shared by every usePerformanceMonitor caller, so metrics accumulate in one map', () => {
    const a = usePerformanceMonitor('CardA');
    const b = usePerformanceMonitor('CardB');
    a.startRender();
    b.startMount();
    a.endRender();
    b.endMount();

    const metrics = perf.getMetrics();
    expect(metrics).toHaveProperty('CardA-render');
    expect(metrics).toHaveProperty('CardB-mount');
  });
});

describe('mark / measure', () => {
  it('measures the elapsed time between the mark and the measure', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    perf.mark('load-list');
    vi.setSystemTime(new Date('2026-01-01T00:00:00.250Z'));

    expect(perf.measure('load-list')).toBe(250);
  });

  it('records the duration under the bare name, keeping the -start key private', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    perf.mark('render-grid');
    vi.setSystemTime(T0 + 40);
    perf.measure('render-grid');

    const metrics = perf.getMetrics();
    expect(metrics['render-grid']).toBe(40);
    expect(Object.keys(metrics).some((key) => key.endsWith('-start'))).toBe(false);
  });

  it('mirrors the timing into the User Timing API', () => {
    const mark = vi.spyOn(performance, 'mark').mockImplementation(() => undefined as never);
    const measure = vi.spyOn(performance, 'measure').mockImplementation(() => undefined as never);

    try {
      perf.mark('api-call');
      perf.measure('api-call');
      expect(mark).toHaveBeenCalledWith('api-call-start');
      expect(mark).toHaveBeenCalledWith('api-call-end');
      expect(measure).toHaveBeenCalledWith('api-call', 'api-call-start', 'api-call-end');
    } finally {
      mark.mockRestore();
      measure.mockRestore();
    }
  });

  it('returns 0 and warns when nothing was marked', () => {
    expect(perf.measure('never-marked')).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith('No start mark found for never-marked');
    expect(perf.getMetrics()).not.toHaveProperty('never-marked');
  });

  it('treats a mark taken at epoch 0 as missing — the `!startTime` guard', () => {
    // Unreachable with a real clock (Date.now() is never 0), but it is why the
    // rest of this file bases its fake time on a real date rather than on 0.
    vi.useFakeTimers();
    vi.setSystemTime(0);
    perf.mark('epoch-zero');
    vi.setSystemTime(30);
    expect(perf.measure('epoch-zero')).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith('No start mark found for epoch-zero');
  });

  it('re-marking restarts the clock rather than stacking', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    perf.mark('retry');
    vi.setSystemTime(T0 + 500);
    perf.mark('retry');
    vi.setSystemTime(T0 + 600);
    expect(perf.measure('retry')).toBe(100);
  });

  it('logs the measurement in a dev build', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    perf.mark('logged');
    vi.setSystemTime(T0 + 12);
    perf.measure('logged');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('logged took 12ms'));
  });

  it('still times things with no performance API at all', () => {
    // The SSR / worker path: `performance` is absent, so the User Timing calls
    // are skipped, but the Date.now-based measurement must survive.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    vi.stubGlobal('performance', undefined);

    perf.mark('no-api');
    vi.setSystemTime(T0 + 75);
    const duration = perf.measure('no-api');

    vi.unstubAllGlobals();
    expect(duration).toBe(75);
  });

  it('skips User Timing when the API exists but mark() does not', () => {
    // Some embedded webviews expose `performance.now` and nothing else.
    vi.stubGlobal('performance', { now: () => 0 });
    expect(() => {
      perf.mark('partial-api');
      perf.measure('partial-api');
    }).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('getMetrics', () => {
  it('returns a snapshot, not the live map', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    perf.mark('snapshot');
    vi.setSystemTime(T0 + 5);
    perf.measure('snapshot');

    const first = perf.getMetrics();
    first['snapshot'] = 9999;
    expect(perf.getMetrics()['snapshot']).toBe(5);
  });
});

describe('getWebVitals', () => {
  it('reports the first contentful paint when the browser recorded one', () => {
    const byName = vi
      .spyOn(performance, 'getEntriesByName')
      .mockReturnValue([{ startTime: 812.5 } as PerformanceEntry]);
    vi.stubGlobal('PerformanceObserver', InertObserver);

    try {
      perf.getWebVitals();
      expect(byName).toHaveBeenCalledWith('first-contentful-paint');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('First Contentful Paint: 812.5'));
    } finally {
      byName.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('says nothing about paint when no entry was recorded', () => {
    const byName = vi.spyOn(performance, 'getEntriesByName').mockReturnValue([]);
    vi.stubGlobal('PerformanceObserver', InertObserver);

    try {
      perf.getWebVitals();
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('First Contentful Paint'));
    } finally {
      byName.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('observes largest-contentful-paint and disconnects after the first report', () => {
    const byName = vi.spyOn(performance, 'getEntriesByName').mockReturnValue([]);
    const observe = vi.fn();
    const disconnect = vi.fn();
    let fire: ((list: { getEntries: () => PerformanceEntry[] }) => void) | null = null;

    class FakeObserver {
      constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
        fire = callback;
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver);

    try {
      perf.getWebVitals();
      expect(observe).toHaveBeenCalledWith({ entryTypes: ['largest-contentful-paint'] });

      // jsdom never paints, so the entry is delivered by hand. The *value* of a
      // real LCP is a browser fact — only the disconnect-after-report contract
      // is assertable here.
      fire!({
        getEntries: () => [{ startTime: 1 } as PerformanceEntry, { startTime: 1900 } as PerformanceEntry]
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Largest Contentful Paint: 1900'));
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      byName.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('does nothing at all without a performance API', () => {
    vi.stubGlobal('performance', undefined);
    expect(() => perf.getWebVitals()).not.toThrow();
    vi.unstubAllGlobals();
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('reportVitals', () => {
  it('reports the navigation timings once the document is complete', () => {
    const byType = vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { domContentLoadedEventEnd: 320, loadEventEnd: 980 } as unknown as PerformanceEntry
    ]);

    try {
      perf.reportVitals();
      expect(byType).toHaveBeenCalledWith('navigation');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dom Content Loaded: 320ms'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Page Load Complete: 980ms'));
    } finally {
      byType.mockRestore();
    }
  });

  it('says nothing when the browser recorded no navigation entry', () => {
    // jsdom's own state: `getEntriesByType('navigation')` is empty.
    expect(() => perf.reportVitals()).not.toThrow();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('says nothing while the document is still loading', () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const byType = vi.spyOn(performance, 'getEntriesByType');

    try {
      perf.reportVitals();
      expect(byType).not.toHaveBeenCalled();
    } finally {
      readyState.mockRestore();
      byType.mockRestore();
    }
  });
});
