import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

/**
 * Modal is markup plus `dialogSurface` -- the portal, the focus trap, Escape,
 * and the page pin. The action's own arithmetic is not retested here; what is
 * asserted is that Modal actually wires it up, because a dialog that does not
 * hold focus is the failure nobody sees in a screenshot.
 *
 * The surface is portalled to <body>, so every query goes through `screen`
 * rather than the render container.
 */

const body = (html: string) => createRawSnippet(() => ({ render: () => html }));

const form = () =>
  body(
    '<div><input aria-label="Email" /><input aria-label="Password" /><button type="button">Sign in</button></div>'
  );

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(Modal, { props: { isOpen: false, children: body('<p>Hidden</p>') } });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('renders a modal dialog with its content when open', () => {
    render(Modal, { props: { isOpen: true, children: body('<p>Sign in to continue</p>') } });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
  });

  it('portals the surface out to <body>, clear of any clipped ancestor', () => {
    const { container } = render(Modal, {
      props: { isOpen: true, children: body('<p>Content</p>') }
    });

    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  describe('dismissal', () => {
    it('closes from the close button, which is named', async () => {
      const onClose = vi.fn();
      render(Modal, { props: { isOpen: true, onClose, children: body('<p>Content</p>') } });

      await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('hides the close button when asked', () => {
      render(Modal, {
        props: { isOpen: true, showCloseButton: false, children: body('<p>Content</p>') }
      });

      expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const onClose = vi.fn();
      render(Modal, { props: { isOpen: true, onClose, children: body('<p>Content</p>') } });

      await userEvent.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on a backdrop click', async () => {
      const onClose = vi.fn();
      const { container } = render(Modal, {
        props: { isOpen: true, onClose, children: body('<p>Content</p>') }
      });
      void container;

      const backdrop = document.querySelector('.weeb-modal-backdrop') as HTMLElement;
      await userEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores the backdrop when it is not closeable', async () => {
      const onClose = vi.fn();
      render(Modal, {
        props: {
          isOpen: true,
          backdropCloseable: false,
          onClose,
          children: body('<p>Content</p>')
        }
      });

      const backdrop = document.querySelector('.weeb-modal-backdrop') as HTMLElement;
      await userEvent.click(backdrop);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('a click inside the card is not a backdrop click', async () => {
      const onClose = vi.fn();
      render(Modal, { props: { isOpen: true, onClose, children: body('<p>Content</p>') } });

      await userEvent.click(screen.getByText('Content'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    /**
     * `dialogSurface` filters its focusable list by `offsetParent !== null`, the
     * cheap "is this actually visible" test. jsdom performs no layout, so
     * `offsetParent` is null for every element and the list comes back empty --
     * the trap would then preventDefault every Tab and prove nothing about
     * where focus goes. Standing in a browser-like `offsetParent` for the
     * duration is what makes the wrap assertable at all; it is a shim around a
     * jsdom limitation, not a claim about layout.
     */
    beforeAll(() => {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
        configurable: true,
        get(this: HTMLElement) {
          return this.isConnected ? document.body : null;
        }
      });
    });

    afterAll(() => {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetParent;
    });

    it('moves focus into the dialog on open', async () => {
      render(Modal, { props: { isOpen: true, children: form() } });

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it('traps Tab inside the dialog, wrapping from the last control to the first', async () => {
      render(Modal, { props: { isOpen: true, showCloseButton: false, children: form() } });

      await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());

      const submit = screen.getByRole('button', { name: 'Sign in' });
      submit.focus();
      await userEvent.tab();

      expect(screen.getByLabelText('Email')).toHaveFocus();
    });

    it('wraps backwards from the first control to the last', async () => {
      render(Modal, { props: { isOpen: true, showCloseButton: false, children: form() } });

      await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());

      await userEvent.tab({ shift: true });

      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
    });

    it('returns focus to whatever opened it on close', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open';
      document.body.appendChild(trigger);
      trigger.focus();
      expect(trigger).toHaveFocus();

      const { unmount } = render(Modal, { props: { isOpen: true, children: form() } });
      await waitFor(() => expect(trigger).not.toHaveFocus());

      unmount();

      expect(trigger).toHaveFocus();
      trigger.remove();
    });
  });

  describe('size', () => {
    /**
     * REGRESSION. There used to be no size API: the card was fixed at 440px and
     * `className="max-w-2xl"` was silently beaten by `:global(.weeb-modal-card)`,
     * which declares `max-width` at the same specificity a utility class does
     * and wins on order. The image cropper was therefore squeezed into a dialog
     * meant for a sign-in form.
     *
     * The width now comes from a modifier class of the same base, so the fix is
     * that the class is there at all. jsdom loads no stylesheet, so the actual
     * 720px cannot be measured here -- `getComputedStyle(card).maxWidth` would
     * be empty for every size and would prove nothing. Measuring it is a browser
     * assertion and belongs in the Playwright/visual layer.
     */
    it('lg asks for the wide card, not the default one', () => {
      render(Modal, { props: { isOpen: true, size: 'lg', children: body('<p>Cropper</p>') } });

      const card = screen.getByRole('dialog');
      expect(card).toHaveClass('weeb-modal-card', 'weeb-modal-card--lg');
      expect(card).not.toHaveClass('weeb-modal-card--sm');
    });

    it('defaults to the form-sized card', () => {
      render(Modal, { props: { isOpen: true, children: body('<p>Sign in</p>') } });

      expect(screen.getByRole('dialog')).toHaveClass('weeb-modal-card--sm');
    });

    it('every size is a modifier of the same card, so none of them is an escape hatch', () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const { unmount } = render(Modal, {
          props: { isOpen: true, size, children: body('<p>Content</p>') }
        });
        expect(screen.getByRole('dialog')).toHaveClass(`weeb-modal-card--${size}`);
        unmount();
      }
    });

    it('still forwards className, for layout the card itself does not own', () => {
      render(Modal, {
        props: { isOpen: true, className: 'my-layout', children: body('<p>Content</p>') }
      });

      expect(screen.getByRole('dialog')).toHaveClass('my-layout', 'weeb-modal-card--sm');
    });
  });
});
