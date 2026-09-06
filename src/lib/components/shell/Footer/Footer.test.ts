import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import Footer from './Footer.svelte';

/**
 * The site footer: a copyright line, three links and the build version.
 *
 * The version comes from `__APP_VERSION__`, which vite defines at config time
 * (`VITE_APP_VERSION` or `'dev'`), so the assertion below reads the same global
 * the component does rather than hard-coding a build number.
 *
 * The 44px hit targets the stylesheet grows with `::after` are the reason this
 * markup looks the way it does, but they are a measurement -- jsdom loads no
 * stylesheet, so that stays with the visual layer.
 */

describe('Footer', () => {
  it('is the page footer landmark', () => {
    render(Footer);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('carries the current year in the copyright line', () => {
    render(Footer);

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      `© ${new Date().getFullYear()} weeb.vip`
    );
  });

  it('links to About, the API and GitHub', () => {
    render(Footer);

    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'API' })).toHaveAttribute(
      'href',
      'https://gateway.weeb.vip/graphql'
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/weeb-vip'
    );
  });

  it('prints the build version vite injected', () => {
    const { container } = render(Footer);

    expect(container.querySelector('.version')).toHaveTextContent(`v${__APP_VERSION__}`);
  });

  it('has nothing in it but those three links', () => {
    render(Footer);

    expect(within(screen.getByRole('contentinfo')).getAllByRole('link')).toHaveLength(3);
  });
});
