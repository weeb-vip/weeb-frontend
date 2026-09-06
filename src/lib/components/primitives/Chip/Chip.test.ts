import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import Chip from './Chip.svelte';

/**
 * Chip renders as whatever it is -- an <a> given an `href`, a <button> given an
 * `onclick`, a <span> otherwise -- so the element it picks IS its contract:
 * `ChipGroup select="none"` relies on the link branch, and a static badge must
 * not be announced as a control.
 *
 * jsdom loads no stylesheets (the component's scoped CSS is never injected and
 * design-tokens.css is never linked), so nothing here asserts a colour, a size
 * or a shape. What it can assert is the class list and the `--chip-color`
 * custom property the whole family of rules is keyed on -- i.e. which rule the
 * browser would apply. The pixels themselves belong to the visual layer.
 */

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Chip', () => {
  describe('which element it renders as', () => {
    it('is a plain <span> with neither href nor onclick -- not a control', () => {
      render(Chip, { props: { label: 'TV' } });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('TV').closest('span')).toBeInTheDocument();
    });

    it('renders an <a> when given an href', () => {
      render(Chip, { props: { label: 'Action', href: '/genre/action' } });

      const link = screen.getByRole('link', { name: 'Action' });
      expect(link).toHaveAttribute('href', '/genre/action');
      expect(link.tagName).toBe('A');
    });

    it('renders a <button> when given an onclick, and calls it', async () => {
      const onclick = vi.fn();
      render(Chip, { props: { label: 'Drama', onclick } });

      const button = screen.getByRole('button', { name: 'Drama' });
      expect(button).toHaveAttribute('type', 'button');

      await userEvent.click(button);
      expect(onclick).toHaveBeenCalledTimes(1);
    });

    it('is inert when disabled', async () => {
      const onclick = vi.fn();
      render(Chip, { props: { label: 'Drama', onclick, disabled: true } });

      const button = screen.getByRole('button', { name: 'Drama' });
      expect(button).toBeDisabled();

      await userEvent.click(button);
      expect(onclick).not.toHaveBeenCalled();
    });

    it('marks a disabled link with aria-disabled, since <a> cannot be disabled', () => {
      render(Chip, { props: { label: 'Action', href: '/genre/action', disabled: true } });

      expect(screen.getByRole('link', { name: 'Action' })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('contents', () => {
    it('renders the label', () => {
      render(Chip, { props: { label: 'Shounen' } });

      expect(screen.getByText('Shounen')).toBeInTheDocument();
    });

    it('lets a children snippet win over the label prop', () => {
      render(Chip, { props: { label: 'ignored', children: label('from snippet') } });

      expect(screen.getByText('from snippet')).toBeInTheDocument();
      expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    });

    /** REGRESSION: a selected chip with a count renders BOTH, not one or the other. */
    it('renders label and count together while selected', () => {
      const { container } = render(Chip, {
        props: { label: 'Action', count: 1234, selected: true }
      });

      expect(screen.getByText('Action')).toBeInTheDocument();
      // Locale-formatted, so read it off the badge rather than guessing the separator.
      const badge = container.querySelector('.chip-count');
      expect(badge).toHaveTextContent((1234).toLocaleString());
      expect(container.querySelector('.chip')).toHaveClass('selected');
    });

    it('still renders a zero count, muted', () => {
      const { container } = render(Chip, { props: { label: 'Yuri', count: 0 } });

      const badge = container.querySelector('.chip-count');
      expect(badge).toHaveTextContent('0');
      expect(badge).toHaveClass('is-zero');
    });

    it('renders no count badge at all when count is null', () => {
      const { container } = render(Chip, { props: { label: 'Yuri', count: null } });

      expect(container.querySelector('.chip-count')).toBeNull();
    });

    it('draws a decorative dot that is hidden from the reader', () => {
      const { container } = render(Chip, { props: { label: 'Release', dot: true } });

      const dot = container.querySelector('.chip-dot');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('the class and custom property the CSS is keyed on', () => {
    it('tints from the tone', () => {
      const { container } = render(Chip, { props: { label: 'Airing', tone: 'green' } });

      const chip = container.querySelector('.chip') as HTMLElement;
      expect(chip.getAttribute('style')).toContain('--chip-color: var(--weeb-green)');
      expect(chip).toHaveClass('chip--colored', 'chip--toned');
    });

    it('an explicit colour beats the tone, for the open set of news categories', () => {
      const { container } = render(Chip, {
        props: { label: 'Release', color: 'var(--cat-release)' }
      });

      const chip = container.querySelector('.chip') as HTMLElement;
      expect(chip.getAttribute('style')).toContain('--chip-color: var(--cat-release)');
      expect(chip).toHaveClass('chip--colored');
    });

    it('a neutral chip is not "coloured", so the dot and wash stay grey', () => {
      const { container } = render(Chip, { props: { label: 'TV' } });

      expect(container.querySelector('.chip')).not.toHaveClass('chip--colored');
    });

    it('tintAtRest=false leaves a coloured chip untoned until it is selected', () => {
      const { container } = render(Chip, {
        props: { label: 'Action', tone: 'green', tintAtRest: false }
      });

      const chip = container.querySelector('.chip') as HTMLElement;
      expect(chip).toHaveClass('chip--colored');
      expect(chip).not.toHaveClass('chip--toned');
    });

    it('carries the size, ghost, touch and mono modifiers it was asked for', () => {
      const { container } = render(Chip, {
        props: { label: '12', size: 'sm', ghost: true, touch: true, mono: true }
      });

      expect(container.querySelector('.chip')).toHaveClass(
        'chip--sm',
        'chip--ghost',
        'chip--touch',
        'chip--mono'
      );
    });
  });

  describe('accessibility', () => {
    it('takes an explicit accessible name, for an icon-only chip', () => {
      render(Chip, { props: { onclick: () => {}, ariaLabel: 'Grid view' } });

      expect(screen.getByRole('button', { name: 'Grid view' })).toBeInTheDocument();
    });

    it('forwards aria-pressed / aria-current / aria-selected verbatim to the button', () => {
      render(Chip, {
        props: { label: 'Winter 2025', onclick: () => {}, ariaCurrent: 'page', ariaPressed: true }
      });

      const button = screen.getByRole('button', { name: 'Winter 2025' });
      expect(button).toHaveAttribute('aria-current', 'page');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('takes a role override so it can sit inside a real tablist', () => {
      render(Chip, {
        props: { label: 'Watching', onclick: () => {}, role: 'tab', ariaSelected: true, tabindex: 0 }
      });

      const tab = screen.getByRole('tab', { name: 'Watching' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(tab).toHaveAttribute('tabindex', '0');
    });
  });
});
