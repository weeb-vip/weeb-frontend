import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import StreamingPlatforms from './StreamingPlatforms.svelte';
import { STREAMING_FLAG, StreamingPlatformsBloc } from './StreamingPlatforms.bloc.svelte';

/** A flag port that only answers true after N asks, like PostHog loading late. */
function flagsAfter(asks: number) {
  let seen = 0;
  return {
    isEnabled: vi.fn(() => ++seen > asks),
    get asks() {
      return seen;
    }
  };
}

afterEach(() => vi.useRealTimers());

describe('StreamingPlatformsBloc', () => {
  describe('the gate', () => {
    it('is off until the flag says otherwise', () => {
      expect(new StreamingPlatformsBloc({ flags: { isEnabled: () => false } }).enabled).toBe(false);
    });

    it('asks once up front, so a resolved flag needs no interval at all', () => {
      const flags = { isEnabled: vi.fn(() => true) };

      const bloc = new StreamingPlatformsBloc({ flags });

      expect(flags.isEnabled).toHaveBeenCalledExactlyOnceWith(STREAMING_FLAG);
      expect(bloc.enabled).toBe(true);
    });

    it('does not poll at all once the answer is known', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => true) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 10 });

      bloc.watchFlag();
      vi.advanceTimersByTime(1000);

      expect(flags.isEnabled).toHaveBeenCalledTimes(1);
    });

    it('keeps asking until the flag resolves, then stops', () => {
      vi.useFakeTimers();
      // `onFeatureFlags` can fire once while the flag still reads false and
      // then never fire again, so the answer has to be re-asked.
      const flags = flagsAfter(3);
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100, maxTries: 25 });

      const stop = bloc.watchFlag();
      vi.advanceTimersByTime(300);
      expect(bloc.enabled).toBe(true);

      const asksWhenResolved = flags.asks;
      vi.advanceTimersByTime(1000);
      expect(flags.asks).toBe(asksWhenResolved);

      stop();
    });

    it('gives up after the try limit rather than polling forever', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => false) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100, maxTries: 5 });

      bloc.watchFlag();
      vi.advanceTimersByTime(100 * 20);

      // One ask in the constructor, then exactly `maxTries` polls.
      expect(flags.isEnabled).toHaveBeenCalledTimes(6);
      expect(bloc.enabled).toBe(false);
    });

    it('stops polling when the view goes away', () => {
      vi.useFakeTimers();
      const flags = { isEnabled: vi.fn(() => false) };
      const bloc = new StreamingPlatformsBloc({ flags, pollMs: 100 });

      bloc.watchFlag()();
      vi.advanceTimersByTime(1000);

      expect(flags.isEnabled).toHaveBeenCalledTimes(1);
    });
  });

  describe('the platform logos', () => {
    const bloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => true } });

    it('serves a bundled logo rather than hotlinking one that 403s', () => {
      expect(bloc().iconFor('crunchyroll')).toBe('/assets/streams/crunchyroll.svg');
      expect(bloc().iconFor('netflix')).toBe('/assets/streams/netflix.svg');
    });

    it('matches whatever case the platform arrived in', () => {
      expect(bloc().iconFor('Crunchyroll')).toBe(bloc().iconFor('crunchyroll'));
      expect(bloc().iconFor('NETFLIX')).toBe(bloc().iconFor('netflix'));
    });

    it('maps a platform’s several names onto one logo', () => {
      const amazon = bloc().iconFor('amazon');

      expect(bloc().iconFor('Prime Video')).toBe(amazon);
      expect(bloc().iconFor('primevideo')).toBe(amazon);

      const apple = bloc().iconFor('apple');
      expect(bloc().iconFor('Apple TV')).toBe(apple);
      expect(bloc().iconFor('appletv')).toBe(apple);
    });

    it('falls back to a generic mark rather than to a broken image', () => {
      expect(bloc().iconFor('some new service')).toBe('/assets/streams/generic.svg');
      expect(bloc().iconFor('')).toBe('/assets/streams/generic.svg');
    });
  });

  describe('the platform links', () => {
    const bloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => true } });

    it('leaves an absolute URL alone', () => {
      expect(bloc().hrefFor('https://www.crunchyroll.com/x')).toBe(
        'https://www.crunchyroll.com/x'
      );
      expect(bloc().hrefFor('http://example.com')).toBe('http://example.com');
    });

    it('gives a bare host a scheme, or it would resolve as a relative path', () => {
      expect(bloc().hrefFor('www.netflix.com/title/1')).toBe('https://www.netflix.com/title/1');
    });
  });
});

/**
 * The view over that bloc. Added alongside the bloc suite above rather than in
 * a file of its own, per the one-test-file-per-component convention: what the
 * gate answers is the bloc's, and what is drawn once it answers is here.
 *
 * The bloc is injected, so nothing reaches PostHog.
 */
describe('StreamingPlatforms (view)', () => {
  const openBloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => true } });
  const closedBloc = () => new StreamingPlatformsBloc({ flags: { isEnabled: () => false } });

  const platforms = [
    { platform: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/x' },
    { platform: 'netflix', url: 'www.netflix.com/title/1' }
  ];

  it('draws one named link per platform, each leaving the site safely', () => {
    render(StreamingPlatforms, { props: { platforms, bloc: openBloc() } });

    const crunchyroll = screen.getByRole('link', { name: 'Watch on Crunchyroll' });
    expect(crunchyroll).toHaveAttribute('href', 'https://www.crunchyroll.com/x');
    expect(crunchyroll).toHaveAttribute('target', '_blank');
    expect(crunchyroll).toHaveAttribute('rel', 'noopener noreferrer');

    // A bare host is given a scheme, or it would resolve as a relative path.
    expect(screen.getByRole('link', { name: 'Watch on netflix' })).toHaveAttribute(
      'href',
      'https://www.netflix.com/title/1'
    );
  });

  it('falls back to the platform key when the row carries no display name', () => {
    render(StreamingPlatforms, { props: { platforms, bloc: openBloc() } });

    expect(screen.getByRole('link', { name: 'Watch on netflix' })).toBeInTheDocument();
  });

  it('labels the row "Watch on" and serves bundled logos, not hotlinked ones', () => {
    const { container } = render(StreamingPlatforms, { props: { platforms, bloc: openBloc() } });

    expect(screen.getByText('Watch on')).toBeInTheDocument();
    // The marks are decorative -- the link is already named -- and they are
    // served from /assets/streams because several hosts 403 hotlinked assets.
    const icons = [...container.querySelectorAll('img')];
    expect(icons.map((img) => img.getAttribute('src'))).toEqual([
      '/assets/streams/crunchyroll.svg',
      '/assets/streams/netflix.svg'
    ]);
    for (const icon of icons) expect(icon).toHaveAttribute('alt', '');
  });

  it.each([
    ['the flag is off', { platforms, bloc: 'closed' }],
    ['the show has no listings', { platforms: [], bloc: 'open' }],
    ['the API sent no listings field', { platforms: undefined, bloc: 'open' }],
    ['the API sent null', { platforms: null, bloc: 'open' }]
  ])('renders nothing at all when %s', (_label, { platforms: rows, bloc }) => {
    const { container } = render(StreamingPlatforms, {
      props: { platforms: rows, bloc: bloc === 'open' ? openBloc() : closedBloc() }
    });

    expect(container.querySelector('.streaming-platforms')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('centres the row on mobile only where the call site asks for it', () => {
    // The class is the contract; whether it actually centres is a media query
    // jsdom never evaluates.
    const { container } = render(StreamingPlatforms, {
      props: { platforms, centerOnMobile: true, bloc: openBloc() }
    });

    expect(container.querySelector('.platforms-list')).toHaveClass('center-mobile');
  });

  it('leaves the row left-aligned by default', () => {
    const { container } = render(StreamingPlatforms, {
      props: { platforms, bloc: openBloc() }
    });

    expect(container.querySelector('.platforms-list')).not.toHaveClass('center-mobile');
  });

  it('draws every listing a heavily-syndicated show carries', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      platform: `service-${i}`,
      url: `https://service-${i}.example/x`
    }));
    const { container } = render(StreamingPlatforms, { props: { platforms: many, bloc: openBloc() } });

    const list = container.querySelector('.platforms-list') as HTMLElement;
    expect(within(list).getAllByRole('link')).toHaveLength(12);
    // An unrecognised service gets the generic mark rather than a broken image.
    expect(within(list).getAllByRole('link')[0].querySelector('img')).toHaveAttribute(
      'src',
      '/assets/streams/generic.svg'
    );
  });
});
