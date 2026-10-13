import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn(async (_query: string, _vars?: any) => ({}) as any);

vi.mock('$lib/server/ssr-graphql', () => ({
  createSSRGraphQLClient: () => ({ request })
}));

const { GET } = await import('./+server');
const { _clearSitemapCache } = await import('$lib/server/sitemap');

const event = (page: string, origin = 'https://weeb.vip') =>
  ({
    params: { page },
    locals: { config: { graphql_host: 'https://api.test/graphql' } },
    url: new URL(`${origin}/sitemap-works-${page}.xml`)
  }) as any;

beforeEach(() => {
  _clearSitemapCache();
  request.mockReset();
  request.mockImplementation(async (_q: string, vars: any) => {
    if (vars.input.perPage === 1) return { works: { total: 3 } };
    return {
      works: {
        total: 3,
        works: [
          { id: 'w1', urlSlug: 'berserk', synopsis: 'Prose.', status: 'Finished' },
          { id: 'w2', urlSlug: 'thin-one', synopsis: '', status: 'Finished' },
          { id: 'w3', urlSlug: 'ongoing', synopsis: '', status: 'Publishing' }
        ]
      }
    };
  });
});

describe('a works sitemap chunk', () => {
  it('lists the slice on the origin that asked, without thin works', async () => {
    const body = await (await GET(event('1', 'https://staging.weeb.vip'))).text();

    expect(body).toContain('<loc>https://staging.weeb.vip/manga/berserk</loc>');
    expect(body).toContain('<loc>https://staging.weeb.vip/manga/ongoing</loc>');
    expect(body).not.toContain('thin-one');
  });

  it('404s past the last chunk and for junk numbers', async () => {
    for (const page of ['2', '0', 'abc']) {
      await expect(GET(event(page))).rejects.toMatchObject({ status: 404 });
    }
  });
});
