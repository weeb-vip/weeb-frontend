import { describe, it, expect } from 'vitest';
import { GET } from './+server';

const run = (environment?: string) =>
  (GET as any)({ locals: { config: environment ? { environment } : undefined } }) as Response;

describe('robots.txt', () => {
  it('opens production to crawlers and points them at the sitemap', async () => {
    const body = await run('production').text();

    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://weeb.vip/sitemap.xml');
    expect(body).toContain('Disallow: /profile/');
    expect(body).not.toMatch(/^Disallow: \/$/m);
  });

  it.each(['staging', 'development', 'local', undefined])('shuts crawlers out of %s', async (env) => {
    const body = await run(env).text();

    expect(body).toMatch(/^Disallow: \/$/m);
    expect(body).not.toContain('Sitemap:');
  });

  it('is plain text', () => {
    expect(run('production').headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });
});
