import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import ErrorBanner from './ErrorBanner.svelte';

/**
 * The severity of this box is not decoration: it decides whether a screen
 * reader interrupts. `alert` is announced immediately, `status` waits for a
 * pause -- getting it backwards is the usual reason a success message talks
 * over someone mid-sentence.
 */

const extra = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('ErrorBanner', () => {
  it('renders the message', () => {
    render(ErrorBanner, { props: { message: 'Could not load your list' } });

    expect(screen.getByText('Could not load your list')).toBeInTheDocument();
  });

  it('renders the cause as a second line when there is one', () => {
    render(ErrorBanner, {
      props: { message: 'Could not load your list', detail: 'Network request failed' }
    });

    expect(screen.getByText('Network request failed')).toBeInTheDocument();
  });

  it('omits the second line when there is nothing to say', () => {
    const { container } = render(ErrorBanner, { props: { message: 'Could not load your list' } });

    expect(container.querySelector('.eb-detail')).toBeNull();
  });

  describe('how it is announced', () => {
    /** A failure interrupts. */
    it('an error is an alert', () => {
      render(ErrorBanner, { props: { message: 'Sign in failed', severity: 'error' } });

      expect(screen.getByRole('alert')).toHaveTextContent('Sign in failed');
    });

    it('a warning is an alert too -- there is a step left to take', () => {
      render(ErrorBanner, { props: { message: 'Verify your email', severity: 'warning' } });

      expect(screen.getByRole('alert')).toHaveTextContent('Verify your email');
    });

    /** A confirmation does not interrupt. */
    it('success is a status, not an alert', () => {
      render(ErrorBanner, { props: { message: 'Saved', severity: 'success' } });

      expect(screen.getByRole('status')).toHaveTextContent('Saved');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('info is a status, not an alert', () => {
      render(ErrorBanner, { props: { message: 'Check your inbox', severity: 'info' } });

      expect(screen.getByRole('status')).toHaveTextContent('Check your inbox');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('defaults to error, which is the interrupting one', () => {
      render(ErrorBanner, { props: { message: 'Something went wrong' } });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('retry', () => {
    it('draws no retry control unless there is something to retry', () => {
      render(ErrorBanner, { props: { message: 'Sign in failed' } });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls back on retry', async () => {
      const onRetry = vi.fn();
      render(ErrorBanner, { props: { message: 'Could not load', onRetry } });

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('takes a custom retry label', () => {
      render(ErrorBanner, {
        props: { message: 'Could not load', onRetry: () => {}, retryLabel: 'Reload' }
      });

      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    });

    it('is inert and renamed while a retry is in flight', async () => {
      const onRetry = vi.fn();
      render(ErrorBanner, { props: { message: 'Could not load', onRetry, retrying: true } });

      const button = screen.getByRole('button', { name: 'Retrying…' });
      expect(button).toBeDisabled();

      await userEvent.click(button);
      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe('trimmings', () => {
    it('hides the icon from the reader -- the severity is already in the role', () => {
      const { container } = render(ErrorBanner, { props: { message: 'Sign in failed' } });

      expect(container.querySelector('.eb-icon')).toHaveAttribute('aria-hidden', 'true');
    });

    it('can drop the icon entirely', () => {
      const { container } = render(ErrorBanner, {
        props: { message: 'Sign in failed', showIcon: false }
      });

      expect(container.querySelector('.eb-icon')).toBeNull();
    });

    it('renders extra content below the message', () => {
      render(ErrorBanner, {
        props: {
          message: 'Your email is not verified',
          severity: 'warning',
          children: extra('<a href="/resend">Resend the email</a>')
        }
      });

      expect(screen.getByRole('link', { name: 'Resend the email' })).toBeInTheDocument();
    });

    it('carries the severity class the CSS keys on', () => {
      const { container } = render(ErrorBanner, {
        props: { message: 'Saved', severity: 'success' }
      });

      expect(container.querySelector('.eb')).toHaveClass('eb--success');
    });
  });
});
