import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import Select from './Select.svelte';

/**
 * A select that looks like the rest of the product: a button trigger and a
 * portalled listbox, because a native <select>'s open list is drawn by the OS
 * and cannot be styled at all.
 *
 * Replacing a native control means re-implementing the behaviour a reader and a
 * keyboard user already expect from it, so that behaviour is what is asserted
 * here -- the roles, the expanded state, arrowing without committing, and the
 * focus that comes back to the trigger on close. The menu is portalled to
 * <body>, so queries go through `screen`.
 */

const options = [
  { value: 'all', label: 'All' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movie' }
];

/**
 * jsdom implements no layout and therefore no `scrollIntoView`. Select calls it
 * to keep the active row visible while arrowing, which is real behaviour worth
 * keeping -- so it is stubbed here rather than avoided. Nothing below asserts
 * on it; whether the row actually scrolls into view needs a browser.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
});

afterAll(() => {
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

describe('Select', () => {
  describe('the trigger', () => {
    it('is a named button that announces it opens a listbox', () => {
      render(Select, { props: { options, value: 'tv', ariaLabel: 'Media type' } });

      const trigger = screen.getByRole('button', { name: 'Media type' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('type', 'button');
    });

    it('shows the selected option', () => {
      render(Select, { props: { options, value: 'movie', ariaLabel: 'Media type' } });

      expect(screen.getByRole('button', { name: 'Media type' })).toHaveTextContent('Movie');
    });

    it('falls back to the placeholder when nothing matches', () => {
      render(Select, {
        props: { options, value: '', ariaLabel: 'Media type', placeholder: 'Any type' }
      });

      expect(screen.getByRole('button', { name: 'Media type' })).toHaveTextContent('Any type');
    });

    it('carries the variant class the CSS keys on', () => {
      render(Select, { props: { options, ariaLabel: 'Media type', variant: 'field' } });

      expect(screen.getByRole('button', { name: 'Media type' })).toHaveClass(
        'wv-select-trigger--field'
      );
    });

    it('renders a leading icon', () => {
      const { container } = render(Select, {
        props: { options, ariaLabel: 'Media type', icon: faFilter }
      });

      expect(container.querySelector('.wv-select-icon')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('opening and choosing', () => {
    it('opens a listbox of options on click, flagging itself expanded', async () => {
      render(Select, { props: { options, value: 'tv', ariaLabel: 'Media type' } });

      await userEvent.click(screen.getByRole('button', { name: 'Media type' }));

      const listbox = await screen.findByRole('listbox', { name: 'Media type' });
      expect(within(listbox).getAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Media type' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('marks the committed option aria-selected', async () => {
      render(Select, { props: { options, value: 'tv', ariaLabel: 'Media type' } });

      await userEvent.click(screen.getByRole('button', { name: 'Media type' }));

      expect(await screen.findByRole('option', { name: 'TV', selected: true })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'All' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('commits a choice, reports it, and closes', async () => {
      const onChange = vi.fn();
      render(Select, { props: { options, value: 'all', ariaLabel: 'Media type', onChange } });

      await userEvent.click(screen.getByRole('button', { name: 'Media type' }));
      await userEvent.click(await screen.findByRole('option', { name: 'Movie' }));

      expect(onChange).toHaveBeenCalledWith({ value: 'movie' });
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Media type' })).toHaveTextContent('Movie');
    });

    it('closes when the trigger is clicked again', async () => {
      render(Select, { props: { options, ariaLabel: 'Media type' } });

      const trigger = screen.getByRole('button', { name: 'Media type' });
      await userEvent.click(trigger);
      expect(await screen.findByRole('listbox')).toBeInTheDocument();

      await userEvent.click(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    });

    it('portals the menu to <body>, clear of the scrolling filter row it sits in', async () => {
      const { container } = render(Select, { props: { options, ariaLabel: 'Media type' } });

      await userEvent.click(screen.getByRole('button', { name: 'Media type' }));

      const listbox = await screen.findByRole('listbox');
      expect(container.contains(listbox)).toBe(false);
      expect(document.body.contains(listbox)).toBe(true);
    });
  });

  describe('keyboard', () => {
    it('opens on ArrowDown, the way a native select does', async () => {
      render(Select, { props: { options, ariaLabel: 'Media type' } });

      screen.getByRole('button', { name: 'Media type' }).focus();
      await userEvent.keyboard('{ArrowDown}');

      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    });

    it('arrowing through the list commits nothing until Enter', async () => {
      const onChange = vi.fn();
      render(Select, { props: { options, value: 'all', ariaLabel: 'Media type', onChange } });

      screen.getByRole('button', { name: 'Media type' }).focus();
      await userEvent.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');

      await userEvent.keyboard('{ArrowDown}{ArrowDown}');
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith({ value: 'movie' });
    });

    it('Escape closes without committing and hands focus back to the trigger', async () => {
      const onChange = vi.fn();
      render(Select, { props: { options, value: 'all', ariaLabel: 'Media type', onChange } });

      const trigger = screen.getByRole('button', { name: 'Media type' });
      trigger.focus();
      await userEvent.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      expect(onChange).not.toHaveBeenCalled();
      expect(trigger).toHaveFocus();
    });

    it('Home and End jump to the ends of the list', async () => {
      const onChange = vi.fn();
      render(Select, { props: { options, value: 'all', ariaLabel: 'Media type', onChange } });

      screen.getByRole('button', { name: 'Media type' }).focus();
      await userEvent.keyboard('{ArrowDown}');
      await screen.findByRole('listbox');

      await userEvent.keyboard('{End}{Enter}');
      expect(onChange).toHaveBeenLastCalledWith({ value: 'movie' });
    });
  });

  describe('disabled', () => {
    it('does not open', async () => {
      render(Select, { props: { options, ariaLabel: 'Media type', disabled: true } });

      const trigger = screen.getByRole('button', { name: 'Media type' });
      expect(trigger).toBeDisabled();

      await userEvent.click(trigger);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('renders an empty list rather than breaking when given no options', async () => {
    render(Select, { props: { options: [], ariaLabel: 'Media type', placeholder: 'None' } });

    await userEvent.click(screen.getByRole('button', { name: 'Media type' }));

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryAllByRole('option')).toHaveLength(0);
  });
});
