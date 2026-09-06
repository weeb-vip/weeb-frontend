import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ProfileAvatar from './ProfileAvatar.svelte';
import { DEFAULT_CDN_USER_URL } from './ProfileAvatar.logic';

/**
 * The user's face at every size the app draws it. The size is not decoration:
 * it decides which CDN variant is requested, and asking for the wrong one is
 * invisible in a screenshot but visible on the screen as a soft avatar.
 */

const srcOf = () => (screen.getByRole('img') as HTMLImageElement).getAttribute('src');

describe('ProfileAvatar', () => {
  describe('which CDN variant it asks for', () => {
    /**
     * REGRESSION. `md` is a 40px circle (w-10 h-10), so a `_32` thumbnail was
     * upscaled even at 1x -- soft on every nav avatar in the product. The
     * smallest variant that is not smaller than the box is `_64`.
     */
    it('md asks for _64, not _32', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', size: 'md' }
      });

      expect(srcOf()).toBe(`${DEFAULT_CDN_USER_URL}/face_64.jpg`);
      expect(srcOf()).not.toContain('_32');
    });

    it('sm, the 32px circle, is the only one that takes _32', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', size: 'sm' }
      });

      expect(srcOf()).toBe(`${DEFAULT_CDN_USER_URL}/face_32.jpg`);
    });

    it('lg takes _64 too', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', size: 'lg' }
      });

      expect(srcOf()).toBe(`${DEFAULT_CDN_USER_URL}/face_64.jpg`);
    });

    it('xl takes the original -- a _64 in a 120px circle is what made a second component look necessary', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', size: 'xl' }
      });

      expect(srcOf()).toBe(`${DEFAULT_CDN_USER_URL}/face.jpg`);
    });

    it('puts the suffix before the extension, not after it', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'my.face.jpeg', size: 'md' }
      });

      expect(srcOf()).toBe(`${DEFAULT_CDN_USER_URL}/my.face_64.jpeg`);
    });

    it('a ready-built src is used verbatim -- the blocs already resolved it', () => {
      render(ProfileAvatar, {
        props: { username: 'james', src: 'https://example.test/me.png', size: 'md' }
      });

      expect(srcOf()).toBe('https://example.test/me.png');
    });
  });

  describe('the initials fallback', () => {
    it('draws the username’s first letter when there is no picture', () => {
      render(ProfileAvatar, { props: { username: 'james' } });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('takes explicit initials, as the public profile page passes', () => {
      render(ProfileAvatar, { props: { username: 'james', initials: 'JA' } });

      expect(screen.getByText('JA')).toBeInTheDocument();
    });

    it('falls back to ? with no username at all', () => {
      render(ProfileAvatar, { props: {} });

      expect(screen.getByText('?')).toBeInTheDocument();
    });

    /**
     * A stale or missing image used to leave a broken <img> in place: the URL is
     * truthy, so the initials branch never ran and the avatar rendered as
     * nothing at all.
     */
    it('swaps to the initials when the image fails to load', async () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'gone.jpg', size: 'md' }
      });

      await fireEvent.error(screen.getByRole('img'));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('J')).toBeInTheDocument();
    });
  });

  describe('naming and linking', () => {
    it('names the picture with the username by default', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', size: 'md' }
      });

      expect(screen.getByRole('img', { name: 'james' })).toBeInTheDocument();
    });

    it('takes an explicit alt', () => {
      render(ProfileAvatar, {
        props: { username: 'james', profileImageUrl: 'face.jpg', alt: 'Your profile picture' }
      });

      expect(screen.getByRole('img', { name: 'Your profile picture' })).toBeInTheDocument();
    });

    it('links to the profile by default', () => {
      render(ProfileAvatar, { props: { username: 'james' } });

      expect(screen.getByRole('link')).toHaveAttribute('href', '/profile');
    });

    it('renders bare where the caller owns the link', () => {
      render(ProfileAvatar, { props: { username: 'james', linkToProfile: false } });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('J')).toBeInTheDocument();
    });
  });

  describe('the circle', () => {
    it('sizes itself at sm/md/lg and fills its wrapper at xl', () => {
      const md = render(ProfileAvatar, { props: { username: 'james', size: 'md' } });
      expect(md.container.querySelector('.w-10')).toBeInTheDocument();
      md.unmount();

      const { container } = render(ProfileAvatar, { props: { username: 'james', size: 'xl' } });
      expect(container.querySelector('.avatar-hero')).toHaveClass('w-full', 'h-full');
    });

    it('uses one accent ground at every size, not a Tailwind gradient at the small ones', () => {
      const { container } = render(ProfileAvatar, { props: { username: 'james', size: 'md' } });

      expect(container.querySelector('.avatar-fallback')).toBeInTheDocument();
      expect(container.querySelector('[class*="from-blue"]')).toBeNull();
    });
  });
});
