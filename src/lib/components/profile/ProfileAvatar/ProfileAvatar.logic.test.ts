import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CDN_USER_URL,
  avatarClasses,
  avatarImageUrl,
  initialFor,
  type ProfileAvatarSize
} from './ProfileAvatar.logic';

const SIZES: ProfileAvatarSize[] = ['sm', 'md', 'lg', 'xl'];
const CDN = 'https://cdn.weeb.vip/users';

describe('initialFor', () => {
  it('takes the username’s first letter, capitalised', () => {
    expect(initialFor(null, 'ada')).toBe('A');
    expect(initialFor(null, 'Ada')).toBe('A');
  });

  it('lets the caller name the initials itself', () => {
    expect(initialFor('AL', 'ada')).toBe('AL');
  });

  it('has something to draw with no username at all', () => {
    expect(initialFor(null, '')).toBe('?');
  });

  it('keeps a non-letter first character as it is', () => {
    expect(initialFor(null, '_ghost')).toBe('_');
    expect(initialFor(null, '9lives')).toBe('9');
  });
});

describe('avatarImageUrl', () => {
  it('has no URL when there is no image', () => {
    expect(avatarImageUrl(null, null, 'md', CDN)).toBeUndefined();
    expect(avatarImageUrl(null, '', 'md', CDN)).toBeUndefined();
  });

  it('lets a ready-built URL win, at every size', () => {
    // The profile blocs already resolved it against their own CDN base;
    // re-deriving it here would be a second answer.
    for (const size of SIZES) {
      expect(avatarImageUrl('https://elsewhere/a.png', 'b.png', size, CDN)).toBe(
        'https://elsewhere/a.png'
      );
    }
  });

  it('asks for the smallest variant that is not smaller than the circle', () => {
    expect(avatarImageUrl(null, 'a.png', 'sm', CDN)).toBe(`${CDN}/a_32.png`);
    // `md` is a 40px circle: `_32` would be upscaled even at 1x.
    expect(avatarImageUrl(null, 'a.png', 'md', CDN)).toBe(`${CDN}/a_64.png`);
    expect(avatarImageUrl(null, 'a.png', 'lg', CDN)).toBe(`${CDN}/a_64.png`);
  });

  it('asks for the original at xl, which sizes its own wrapper', () => {
    // A `_64` in a 120px circle is what made a second component look necessary.
    expect(avatarImageUrl(null, 'a.png', 'xl', CDN)).toBe(`${CDN}/a.png`);
  });

  it('puts the suffix before the extension, not after it', () => {
    for (const size of SIZES) {
      expect(avatarImageUrl(null, 'a.png', size, CDN)).toMatch(/\.png$/);
    }
  });

  it('splits on the last dot, so a dotted filename keeps its extension', () => {
    expect(avatarImageUrl(null, 'my.avatar.v2.jpeg', 'sm', CDN)).toBe(
      `${CDN}/my.avatar.v2_32.jpeg`
    );
  });

  it('appends the suffix when the key has no extension at all', () => {
    expect(avatarImageUrl(null, 'abc123', 'sm', CDN)).toBe(`${CDN}/abc123_32`);
    expect(avatarImageUrl(null, 'abc123', 'xl', CDN)).toBe(`${CDN}/abc123`);
  });

  it('builds against whichever CDN base it was handed', () => {
    expect(avatarImageUrl(null, 'a.png', 'sm', 'https://other.cdn/u')).toBe(
      'https://other.cdn/u/a_32.png'
    );
  });

  it('has a base to fall back on when nothing supplied one', () => {
    expect(DEFAULT_CDN_USER_URL).toBe('https://cdn.weeb.vip/users');
  });
});

describe('avatarClasses', () => {
  it('gives each fixed size its own box', () => {
    expect(avatarClasses('sm', '')).toContain('w-8 h-8');
    expect(avatarClasses('md', '')).toContain('w-10 h-10');
    expect(avatarClasses('lg', '')).toContain('w-16 h-16');
  });

  it('makes the fixed sizes round, interactive circles', () => {
    for (const size of ['sm', 'md', 'lg'] as ProfileAvatarSize[]) {
      expect(avatarClasses(size, '')).toContain('rounded-full');
      expect(avatarClasses(size, '')).toContain('hover:ring-2');
    }
  });

  it('lets xl fill whatever wrapper the hero sized', () => {
    const classes = avatarClasses('xl', '');

    expect(classes).toContain('w-full h-full');
    expect(classes).not.toContain('rounded-full');
  });

  it('keeps the caller’s own classes at every size', () => {
    for (const size of SIZES) {
      expect(avatarClasses(size, 'ring-offset-black')).toContain('ring-offset-black');
    }
  });
});
