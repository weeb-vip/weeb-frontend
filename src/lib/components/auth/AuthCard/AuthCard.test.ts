import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import AuthCard from './AuthCard.svelte';

/**
 * The shell every auth screen sits in. Two kinds of assertion live here: the
 * ordinary rendering of the card, and one regression that cannot be asserted
 * through the DOM at all -- see below.
 */

const body = (html: string) => createRawSnippet(() => ({ render: () => html }));

// Read off disk rather than imported: the assertion below is about the
// stylesheet as authored, and vitest runs from the repo root.
const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/lib/components/auth/AuthCard/AuthCard.svelte'),
  'utf8'
);

/**
 * The declared rules only. Comments are stripped first: the style block
 * deliberately documents the selector that caused the bug, and a naive search
 * would match the tombstone rather than a live rule.
 */
const rules = SOURCE.slice(SOURCE.indexOf('<style>')).replace(/\/\*[\s\S]*?\*\//g, '');

describe('AuthCard', () => {
  describe('the card', () => {
    it('renders its children inside a main landmark', () => {
      render(AuthCard, { props: { children: body('<p>Sign in form</p>') } });

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(screen.getByText('Sign in form')).toBeInTheDocument();
    });

    it('renders the title as the page h1', () => {
      render(AuthCard, {
        props: { title: 'Welcome back', children: body('<p>Form</p>') }
      });

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      render(AuthCard, {
        props: { title: 'Welcome back', subtitle: 'Sign in to continue', children: body('<p>Form</p>') }
      });

      expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
    });

    it('takes a headingId, so a caller can point an aria-labelledby at it', () => {
      render(AuthCard, {
        props: { title: 'Welcome back', headingId: 'auth-heading', children: body('<p>Form</p>') }
      });

      expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'auth-heading');
    });

    it('draws no header at all when it has neither title nor subtitle', () => {
      const { container } = render(AuthCard, { props: { children: body('<p>Form</p>') } });

      expect(container.querySelector('.card-header')).toBeNull();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('renders media above the heading, for a verifying spinner', () => {
      const { container } = render(AuthCard, {
        props: { media: body('<div data-media="spinner"></div>'), children: body('<p>Form</p>') }
      });

      expect(container.querySelector('[data-media="spinner"]')).toBeInTheDocument();
    });

    it('renders the footer line under the card body', () => {
      render(AuthCard, {
        props: {
          children: body('<p>Form</p>'),
          footer: body('<span>No account? <a href="/auth/register">Sign up</a></span>')
        }
      });

      expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    });
  });

  describe('the logo and the backdrop', () => {
    it('the logo is a named way home', () => {
      render(AuthCard, { props: { children: body('<p>Form</p>') } });

      expect(
        screen.getByRole('link', { name: 'weeb.vip - back to homepage' })
      ).toHaveAttribute('href', '/');
    });

    it('can be turned off', () => {
      render(AuthCard, { props: { showLogo: false, children: body('<p>Form</p>') } });

      expect(screen.queryByRole('link', { name: /weeb\.vip/ })).not.toBeInTheDocument();
    });

    it('the fixed gradient is decorative, and a second card on screen can turn it off', () => {
      const on = render(AuthCard, { props: { children: body('<p>Form</p>') } });
      const bg = on.container.querySelector('.page-bg');
      expect(bg).toHaveAttribute('aria-hidden', 'true');
      on.unmount();

      const off = render(AuthCard, {
        props: { showBackground: false, children: body('<p>Form</p>') }
      });
      expect(off.container.querySelector('.page-bg')).toBeNull();
    });
  });

  describe('the specificity trap', () => {
    /**
     * REGRESSION -- and one this environment cannot pin through the DOM.
     *
     * The bug: AuthCard used to re-declare FormInput's field styling as
     * `.card-body :global(input[type='text'|'password'|'email'])`, specificity
     * (0,2,1). FormInput's own `:global(.weeb-form-input.has-error)` is (0,2,0),
     * so the shell silently won the cascade and the red error border never
     * rendered on ANY auth page -- the same field went red inside the login
     * modal and stayed neutral grey on /auth/login.
     *
     * Why not a rendered assertion: the bug is a cascade outcome, and jsdom
     * resolves no cascade. It loads neither `design-tokens.css` (where
     * `.weeb-form-input.has-error` lives) nor the component's scoped styles --
     * `document.styleSheets` is empty in this environment -- so
     * `getComputedStyle(input).borderColor` is `''` whether the bug is present
     * or not. Rendering a FormInput inside this card and asserting it still
     * carries `has-error` would look like a test of the fix and be nothing of
     * the kind: the class was always there; it was outranked.
     *
     * So this is asserted where the bug actually lives -- the stylesheet. The
     * shell must declare no rule that reaches a form control at all: the shell
     * owns the card, FormInput owns the field. The visual half ("an invalid
     * email on /auth/login is red") is a browser assertion and belongs in the
     * Playwright/visual layer.
     */
    it('declares no selector that reaches a form control', () => {
      expect(rules).not.toMatch(/input/i);
      expect(rules).not.toMatch(/\btextarea\b/i);
      expect(rules).not.toMatch(/\.weeb-form-/);
    });

    it('has no :global() escape beyond the footer link it owns', () => {
      const globals = [...rules.matchAll(/:global\(([^)]*)\)/g)].map((m) => m[1].trim());

      // The footer's own anchors are the shell's to style; nothing else is.
      expect(globals).toEqual(['a', 'a:hover']);
    });

    it('renders the fields it is given untouched, as plain children', () => {
      render(AuthCard, {
        props: {
          title: 'Welcome back',
          children: body(
            '<input class="weeb-form-input has-error" type="email" aria-label="Email" />'
          )
        }
      });

      // Structural only: the shell wraps the field and adds nothing to it.
      // Which rule wins for that `has-error` class is a cascade question, and
      // the assertion above is where it is answered.
      expect(screen.getByLabelText('Email')).toHaveClass('weeb-form-input', 'has-error');
    });
  });
});
