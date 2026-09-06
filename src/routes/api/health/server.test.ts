import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * GET /api/health. Kubernetes reads this, so the contract is narrow and
 * absolute: a 200 with `status: "ok"`, a fresh timestamp, and no dependency on
 * anything that could be down -- a health check that queries the gateway
 * reports the gateway's health, not the pod's, and takes the pod out of
 * rotation for someone else's outage.
 */

const { GET } = await import('./+server');

afterEach(() => {
  vi.useRealTimers();
  delete process.env.PUBLIC_APP_ENV;
});

describe('the health response', () => {
  it('is a 200', () => {
    expect(GET().status).toBe(200);
  });

  it('declares JSON', () => {
    expect(GET().headers.get('content-type')).toContain('application/json');
  });

  it('reports ok, which is what the probe matches on', async () => {
    const body = await GET().json();

    expect(body.status).toBe('ok');
    expect(body.message).toBe('Health check passed');
  });

  it('stamps the moment it answered, as an ISO instant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));

    expect((await GET().json()).timestamp).toBe('2026-04-15T12:00:00.000Z');
  });

  it('stamps each call afresh rather than the moment the module loaded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    const first = (await GET().json()).timestamp;
    vi.setSystemTime(new Date('2026-04-15T12:00:05Z'));

    expect((await GET().json()).timestamp).not.toBe(first);
  });

  it('names the environment it is running as', async () => {
    process.env.PUBLIC_APP_ENV = 'staging';

    expect((await GET().json()).environment).toBe('staging');
  });

  it('says "unknown" rather than omitting the field when nothing is configured', async () => {
    delete process.env.PUBLIC_APP_ENV;

    expect((await GET().json()).environment).toBe('unknown');
  });

  it('says "unknown" for an empty value, not an empty string', async () => {
    process.env.PUBLIC_APP_ENV = '';

    expect((await GET().json()).environment).toBe('unknown');
  });

  it('takes no request argument, so nothing about the caller can change it', () => {
    expect(GET.length).toBe(0);
  });
});
