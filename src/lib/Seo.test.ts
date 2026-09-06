/**
 * `Seo` renders nothing a visitor can see — its entire output is `<svelte:head>`
 * — so every assertion here reads `document.head` after mounting it. That is the
 * only place the component's behaviour is observable, and the two decisions it
 * encodes are easy to break silently: `og:image` resolves against the host that
 * served the page (so a staging deploy points at its own image), while the
 * canonical, `og:url` and `twitter:url` stay pinned to production (so staging
 * never self-canonicalises into an indexable duplicate).
 *
 * `$app/stores` is stubbed with a real writable store: the component reads
 * `$page.url`, and SvelteKit's own `page` store needs an app context that no
 * unit test has.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Seo from './Seo.svelte';

// A minimal readable store, written out rather than imported: the mock factory
// is hoisted above every import, so it cannot reach `writable` from here.
const { page } = vi.hoisted(() => {
  let value: { url: URL } = { url: new URL('https://weeb.vip/') };
  const subscribers = new Set<(v: { url: URL }) => void>();

  return {
    page: {
      set(next: { url: URL }) {
        value = next;
        for (const notify of subscribers) notify(value);
      },
      subscribe(notify: (v: { url: URL }) => void) {
        notify(value);
        subscribers.add(notify);
        return () => subscribers.delete(notify);
      }
    }
  };
});

vi.mock('$app/stores', () => ({ page }));

const DEFAULT_TITLE = 'WeebVIP - Track Your Anime Watchlist';
const DEFAULT_DESCRIPTION =
  'Discover, track, and manage your anime watchlist with WeebVIP. Get notifications for new episodes, explore seasonal anime, and connect with other anime fans.';

/** The last matching tag in the head — the one this render put there. */
function head(selector: string): Element | null {
  const all = document.head.querySelectorAll(selector);
  return all.length ? all[all.length - 1] : null;
}

const meta = (name: string) => head(`meta[name="${name}"]`)?.getAttribute('content');
const og = (property: string) => head(`meta[property="${property}"]`)?.getAttribute('content');
const canonical = () => head('link[rel="canonical"]')?.getAttribute('href');

function at(url: string) {
  page.set({ url: new URL(url) });
}

beforeEach(() => at('https://weeb.vip/'));

describe('the page title', () => {
  it('brands a page title', () => {
    render(Seo, { props: { title: 'Cowboy Bebop' } });

    expect(document.title).toBe('Cowboy Bebop | WeebVIP');
  });

  it('falls back to the site title when a page gives none', () => {
    render(Seo, { props: {} });

    expect(document.title).toBe(DEFAULT_TITLE);
  });

  it('repeats the title into og:title and twitter:title', () => {
    render(Seo, { props: { title: 'Cowboy Bebop' } });

    expect(og('og:title')).toBe('Cowboy Bebop | WeebVIP');
    expect(meta('twitter:title')).toBe('Cowboy Bebop | WeebVIP');
    // The share-card image needs alt text, and the title is the honest one.
    expect(og('og:image:alt')).toBe('Cowboy Bebop | WeebVIP');
  });
});

describe('the description', () => {
  it('uses the page’s own description everywhere it is quoted', () => {
    render(Seo, { props: { description: 'A bounty hunter drama.' } });

    expect(meta('description')).toBe('A bounty hunter drama.');
    expect(og('og:description')).toBe('A bounty hunter drama.');
    expect(meta('twitter:description')).toBe('A bounty hunter drama.');
  });

  it('falls back to the site description', () => {
    render(Seo, { props: {} });

    expect(meta('description')).toBe(DEFAULT_DESCRIPTION);
  });

  it('treats an empty description as no description', () => {
    render(Seo, { props: { description: '' } });

    expect(meta('description')).toBe(DEFAULT_DESCRIPTION);
  });
});

describe('the canonical URL', () => {
  it('names the production URL for the current path', () => {
    at('https://weeb.vip/anime/cowboy-bebop');

    render(Seo, { props: {} });

    expect(canonical()).toBe('https://weeb.vip/anime/cowboy-bebop');
    expect(og('og:url')).toBe('https://weeb.vip/anime/cowboy-bebop');
    expect(meta('twitter:url')).toBe('https://weeb.vip/anime/cowboy-bebop');
  });

  it('keeps pointing at production from a staging deploy', () => {
    at('https://staging.weeb.vip/anime/cowboy-bebop');

    render(Seo, { props: {} });

    // Self-canonicalising on staging would offer Google a duplicate of the site.
    expect(canonical()).toBe('https://weeb.vip/anime/cowboy-bebop');
  });

  it('drops the query string, which is not part of the canonical page', () => {
    at('https://weeb.vip/search?q=bebop&page=2');

    render(Seo, { props: {} });

    expect(canonical()).toBe('https://weeb.vip/search');
  });
});

describe('the share image', () => {
  it('resolves a page’s image against the host that served the page', () => {
    at('https://staging.weeb.vip/anime/cowboy-bebop');

    render(Seo, { props: { image: '/og/anime-1' } });

    // Against the canonical host this would 404: that deployment has no such image.
    expect(og('og:image')).toBe('https://staging.weeb.vip/og/anime-1');
    expect(meta('twitter:image')).toBe('https://staging.weeb.vip/og/anime-1');
  });

  it('falls back to the branded default image', () => {
    render(Seo, { props: {} });

    expect(og('og:image')).toBe('https://weeb.vip/assets/og-image.jpg');
  });

  it('leaves an absolute image URL alone', () => {
    render(Seo, { props: { image: 'https://cdn.example.test/banner.jpg' } });

    expect(og('og:image')).toBe('https://cdn.example.test/banner.jpg');
  });

  it('declares the dimensions every image it serves actually has', () => {
    render(Seo, { props: {} });

    expect(og('og:image:width')).toBe('1200');
    expect(og('og:image:height')).toBe('630');
  });
});

describe('the fixed card metadata', () => {
  it('describes the site and the card type', () => {
    render(Seo, { props: {} });

    expect(og('og:type')).toBe('website');
    expect(og('og:site_name')).toBe('WeebVIP');
    expect(og('og:locale')).toBe('en_US');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:site')).toBe('@weebvip');
    expect(meta('twitter:creator')).toBe('@weebvip');
  });
});

describe('noIndex', () => {
  it('adds no robots directive by default — pages are indexable', () => {
    render(Seo, { props: { title: 'Cowboy Bebop' } });

    expect(head('meta[name="robots"]')).toBeNull();
  });

  it('asks crawlers to stay away when a page opts out', () => {
    render(Seo, { props: { title: 'Your profile', noIndex: true } });

    expect(meta('robots')).toBe('noindex, nofollow');
  });

  it('still describes the page for anyone who is handed the link', () => {
    render(Seo, { props: { title: 'Your profile', noIndex: true } });

    // noindex is not "no metadata": a Slack/Discord unfurl still uses these.
    expect(og('og:title')).toBe('Your profile | WeebVIP');
    expect(canonical()).toBe('https://weeb.vip/');
  });
});

describe('the head it leaves behind', () => {
  it('contributes exactly one of each tag, so unmounting cleans up after itself', () => {
    // Every other test in this file mounts too; if unmounting left its tags
    // behind, the counts here would climb with the file's length.
    render(Seo, { props: { title: 'Cowboy Bebop' } });

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });
});
