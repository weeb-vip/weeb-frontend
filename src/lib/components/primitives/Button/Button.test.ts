import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import Button from './Button.svelte';
import { STATUS_HOLD_MS } from './Button.logic';

/**
 * The reference component test for this codebase: a real Svelte 5 component,
 * mounted into jsdom by @testing-library/svelte, driven through the accessible
 * role and name rather than through class names or test ids.
 *
 * Anything that is a pure decision -- which classes a size/colour pair
 * produces, which phase a status maps to -- belongs in `Button.logic.ts` and is
 * tested as a function, not through the DOM. What is left here is the markup
 * and the wiring, plus the two regressions the audit found: the collapsing
 * loading state and the nameless icon button.
 */

/** Children arrive as a snippet in Svelte 5, so a test has to build one. */
const label = (text: string) =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
  it('renders its children as the accessible name', () => {
    render(Button, { props: { children: label('Add to list') } });

    expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(Button, { props: { children: label('Save'), onClick } });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is inert when disabled', async () => {
    const onClick = vi.fn();
    render(Button, { props: { children: label('Save'), onClick, disabled: true } });

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();

    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  describe('as a link', () => {
    it('renders an <a> given an href, so a link CTA is never hand-rolled', () => {
      render(Button, { props: { children: label('Browse'), href: '/browse' } });

      const link = screen.getByRole('link', { name: 'Browse' });
      expect(link).toHaveAttribute('href', '/browse');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('an inert link says so with aria-disabled and refuses the click', async () => {
      const onClick = vi.fn();
      render(Button, {
        props: { children: label('Browse'), href: '/browse', disabled: true, onClick }
      });

      const link = screen.getByRole('link', { name: 'Browse' });
      expect(link).toHaveAttribute('aria-disabled', 'true');

      await userEvent.click(link);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessible name', () => {
    /**
     * REGRESSION. The 32px round icon-only button had no accessible name at
     * all: the icon is decorative and there is no label, so `ariaLabel` is the
     * only thing that can name it.
     */
    it('an icon-only button is named by ariaLabel', () => {
      render(Button, { props: { size: 'icon', icon: faPlus, ariaLabel: 'Add to list' } });

      const button = screen.getByRole('button', { name: 'Add to list' });
      expect(button).toHaveClass('btn--icon');
      // Nothing else in the button could have named it: there is no text.
      expect(button.textContent?.trim()).toBe('');
    });
  });

  describe('loading', () => {
    /**
     * REGRESSION. Swapping the label for a spinner collapsed the control
     * mid-request (151px -> 50px), so the label stays in the flow underneath at
     * opacity 0 and the spinner is an absolutely-positioned overlay.
     *
     * jsdom neither lays out nor loads the component's CSS, so this asserts the
     * structural half -- the label node is still rendered, marked with the class
     * that hides it, and the state overlay is a *sibling* rather than a
     * replacement. "151px must not become 50px" is a measurement and belongs to
     * the Playwright/visual layer.
     */
    it('keeps the label in the flow under the spinner rather than replacing it', () => {
      const { container } = render(Button, {
        props: { children: label('Add to my list'), loading: true }
      });

      const button = screen.getByRole('button', { name: 'Add to my list' });

      const content = container.querySelector('.btn-content') as HTMLElement;
      expect(content).toHaveTextContent('Add to my list');
      expect(content).toHaveClass('btn-content--under');

      const state = container.querySelector('.btn-state') as HTMLElement;
      expect(state).toBeInTheDocument();
      expect(state).toHaveAttribute('aria-hidden', 'true');
      expect(state.querySelector('.btn-spinner')).toBeInTheDocument();

      // Sibling, not parent: the spinner overlays the content, it does not wrap it.
      expect(state.contains(content)).toBe(false);
      expect(button.contains(content)).toBe(true);
    });

    it('is busy and inert while loading', async () => {
      const onClick = vi.fn();
      render(Button, { props: { children: label('Save'), loading: true, onClick } });

      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();

      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is idle -- no state overlay -- by default', () => {
      const { container } = render(Button, { props: { children: label('Save') } });

      expect(container.querySelector('.btn-state')).toBeNull();
      expect(container.querySelector('.btn-content')).not.toHaveClass('btn-content--under');
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy');
    });
  });

  describe('transient success and error', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the success mark, keeps the label in flow, then retires on its own', async () => {
      vi.useFakeTimers();
      const onResetStatus = vi.fn();
      const { container } = render(Button, {
        props: { children: label('Save'), status: 'success', onResetStatus }
      });

      expect(container.querySelector('.btn-state')).toBeInTheDocument();
      expect(container.querySelector('.btn-content')).toHaveTextContent('Save');

      await vi.advanceTimersByTimeAsync(STATUS_HOLD_MS);

      expect(onResetStatus).toHaveBeenCalledTimes(1);
      expect(container.querySelector('.btn-state')).toBeNull();
    });

    it('a loading state never retires on its own -- the caller ends it', async () => {
      vi.useFakeTimers();
      const onResetStatus = vi.fn();
      const { container } = render(Button, {
        props: { children: label('Save'), status: 'loading', onResetStatus }
      });

      await vi.advanceTimersByTimeAsync(STATUS_HOLD_MS * 2);

      expect(onResetStatus).not.toHaveBeenCalled();
      expect(container.querySelector('.btn-spinner')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('carries the size, colour and width classes the CSS keys on', () => {
      render(Button, {
        props: { children: label('Sign in'), size: 'lg', color: 'red', fullWidth: true }
      });

      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass(
        'btn',
        'btn--lg',
        'btn-danger',
        'btn--full'
      );
    });

    it('defaults to type="button", so a Button in a form is inert unless it asks to submit', () => {
      render(Button, { props: { children: label('Cancel') } });

      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
    });

    it('submits when asked to', () => {
      render(Button, { props: { children: label('Sign in'), type: 'submit' } });

      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit');
    });
  });

  it('renders an icon alongside a label without disturbing the accessible name', async () => {
    render(Button, { props: { children: label('Add'), icon: faPlus } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });
  });
});
