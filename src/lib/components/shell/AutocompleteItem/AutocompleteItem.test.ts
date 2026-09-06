import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AutocompleteItem from './AutocompleteItem.svelte';

/**
 * One row of the search panel. Which row is highlighted and what choosing one
 * does belong to `AutocompleteAdvancedBloc`; how an anime hit and a work hit
 * differ is decided in `AutocompleteItem.logic` and asserted there. What is
 * left -- and what is here -- is the row's ARIA shape, the two ways it can be
 * chosen, and that the decided view actually reaches the markup.
 *
 * The cover is a `SafeImage`, which resolves its source by loading candidates.
 * jsdom loads no images, so the row renders SafeImage's placeholder box and
 * there is no `<img>` to assert on -- that belongs to the visual layer.
 */

const ANIME = {
  id: 'a1',
  title_en: 'Frieren',
  title_jp: '葬送のフリーレン',
  start_date: '2023-09-29T00:00:00Z'
};

const WORK = {
  __kind: 'work',
  id: 'w1',
  title_en: 'Sword Art Online',
  type: 'LIGHT_NOVEL',
  published_from: '2009-04-10T00:00:00Z'
};

describe('AutocompleteItem', () => {
  describe('the ARIA shape a combobox listbox needs', () => {
    it('is an option that says whether it is the active one', () => {
      render(AutocompleteItem, { props: { item: ANIME, onClick: () => {}, active: true } });

      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('aria-selected', 'true');
    });

    it('is not selected when another row is active', () => {
      render(AutocompleteItem, { props: { item: ANIME, onClick: () => {} } });

      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
    });

    /**
     * The input keeps focus and points at the active row with
     * `aria-activedescendant`, so the row needs the id it was given and must
     * stay out of the tab order.
     */
    it('carries the id the listbox owner addresses it by, and takes no tab stop', () => {
      render(AutocompleteItem, {
        props: { item: ANIME, onClick: () => {}, id: 'ac-opt-desktop-2' }
      });

      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('id', 'ac-opt-desktop-2');
      expect(option).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('what it draws', () => {
    it('names an anime hit by its English title, with the year underneath', () => {
      render(AutocompleteItem, { props: { item: ANIME, onClick: () => {} } });

      const option = screen.getByRole('option');
      expect(option).toHaveTextContent('Frieren');
      expect(option).toHaveTextContent('2023');
    });

    it('falls back to the Japanese title when there is no English one', () => {
      render(AutocompleteItem, {
        props: { item: { ...ANIME, title_en: null }, onClick: () => {} }
      });

      expect(screen.getByRole('option')).toHaveTextContent('葬送のフリーレン');
    });

    /**
     * A work sits a few rows from the anime of the same name, so the line under
     * the title has to say which kind of thing it is -- not just a year.
     */
    it('says what kind of thing a work is before its year', () => {
      render(AutocompleteItem, { props: { item: WORK, onClick: () => {} } });

      const option = screen.getByRole('option');
      expect(option).toHaveTextContent('Sword Art Online');
      expect(option).toHaveTextContent('Light novel · 2009');
    });

    it('draws a row with no titles at all rather than failing', () => {
      render(AutocompleteItem, { props: { item: { id: 'a9' }, onClick: () => {} } });

      expect(screen.getByRole('option')).toBeInTheDocument();
    });
  });

  describe('choosing it', () => {
    it('reports a click', async () => {
      const onClick = vi.fn();
      render(AutocompleteItem, { props: { item: ANIME, onClick } });

      await userEvent.click(screen.getByRole('option'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('reports Enter, for a pointer-less selection', async () => {
      const onClick = vi.fn();
      render(AutocompleteItem, { props: { item: ANIME, onClick } });

      const option = screen.getByRole('option');
      option.focus();
      await userEvent.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('ignores any other key', async () => {
      const onClick = vi.fn();
      render(AutocompleteItem, { props: { item: ANIME, onClick } });

      const option = screen.getByRole('option');
      option.focus();
      await userEvent.keyboard('a{Escape}{ArrowDown}');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('carries the highlight class the panel keys on when active', () => {
    render(AutocompleteItem, { props: { item: ANIME, onClick: () => {}, active: true } });

    // Class, not appearance: jsdom applies no stylesheet. This is the hook the
    // panel's own CSS and its scroll-into-view logic look for.
    expect(screen.getByRole('option')).toHaveClass('ac-item-active');
  });
});
