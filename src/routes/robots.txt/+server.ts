import type { RequestHandler } from './$types';

/**
 * robots.txt, per environment.
 *
 * This was a static file, so staging served production's "Allow: /" and its
 * pages were open to crawling. Their canonicals point at weeb.vip, which kept
 * them out of the index, but every page Googlebot fetched there was crawl
 * budget not spent on production. Anything that is not production now refuses
 * crawlers outright.
 */
const PRODUCTION = `User-agent: *
Allow: /

# Sitemap
Sitemap: https://weeb.vip/sitemap.xml

# No Crawl-delay. Google ignores it, but Bing and Yandex honour it — at one request
# per second the ~32,000 show pages take over nine hours of continuous crawling to
# get through, which throttles indexing far more than it protects the origin. The
# site is behind Cloudflare; rate limiting belongs there, not here.

# Disallow private/auth areas
Disallow: /auth/
Disallow: /profile/
Disallow: /settings

# Allow public pages
Allow: /
Allow: /show/
Allow: /airing
Allow: /airing/calendar

# Block dynamic search parameters. No Allow exception for utm_: Google resolves
# competing rules by longest match, so "Allow: /*?utm_*" did not preserve campaign
# tracking -- it specifically un-blocked the one query shape that is always a
# duplicate of the clean URL. Campaign traffic still arrives and is still measured;
# only crawling of the tagged copies is refused.
Disallow: /*?*
`;

const ELSEWHERE = `# Not production. The real site is https://weeb.vip.
User-agent: *
Disallow: /
`;

export const GET: RequestHandler = ({ locals }) =>
  new Response(locals.config?.environment === 'production' ? PRODUCTION : ELSEWHERE, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    }
  });
