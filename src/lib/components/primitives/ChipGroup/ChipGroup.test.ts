import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ChipGroup from './ChipGroup.svelte';
import type { ChipGroupItem } from './ChipGroup.logic';

/**
 * ChipGroup is the one row of chips in the app, and the ARIA shape it picks is
 * the part most easily broken by accident: `role="tab"` overrides a button's
 * implicit role, so a strip that merely navigates stops being a button to
 * everything that looks for one -- which is exactly how `season.spec.ts` broke.
 *
 * Everything below is asserted through roles and accessible names. jsdom
 * applies no CSS, so the skins (`pill` / `underline`) are only checked as the
 * class the browser would key on, never as an appearance.
 */

const items: ChipGroupItem[] = [
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' }
];

describe('ChipGroup', () => {
  describe('single + toggle + activeMarker="current" -- the navigating strip', () => {
    /**
     * REGRESSION. The season strips navigate: nothing is "pressed" and no panel
     * is revealed, so each chip must keep its implicit button role and say where
     * you are with `aria-current="page"`. `role="tab"` here is what previously
     * broke `season.spec.ts`, and `aria-pressed` would claim a toggle that is
     * not one.
     */
    it('renders plain buttons -- no tabs, no aria-pressed -- and marks the active one aria-current="page"', () => {
      render(ChipGroup, {
        props: {
          items,
          select: 'single',
          mode: 'toggle',
          activeMarker: 'current',
          value: 'spring',
          ariaLabel: 'Season'
        }
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);

      // The role that would have broken the e2e suite must not appear at all.
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

      for (const button of buttons) {
        expect(button).not.toHaveAttribute('aria-pressed');
        expect(button).not.toHaveAttribute('role');
      }

      expect(screen.getByRole('button', { name: 'Spring' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('button', { name: 'Winter' })).not.toHaveAttribute('aria-current');
    });

    it('leaves every chip its own tab stop -- no roving tabindex outside a tablist', () => {
      render(ChipGroup, {
        props: { items, select: 'single', mode: 'toggle', activeMarker: 'current', value: 'spring' }
      });

      for (const button of screen.getAllByRole('button')) {
        expect(button).not.toHaveAttribute('tabindex');
      }
    });
  });

  describe('single + toggle + activeMarker="pressed" -- the mode switch', () => {
    it('uses aria-pressed and still keeps the implicit button role', () => {
      render(ChipGroup, {
        props: {
          items: [
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' }
          ],
          select: 'single',
          mode: 'toggle',
          value: 'grid',
          ariaLabel: 'Layout'
        }
      });

      expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.getByRole('group', { name: 'Layout' })).toBeInTheDocument();
    });
  });

  describe('single + tabs -- the real tablist', () => {
    it('is a tablist of tabs with one tab stop and aria-selected', () => {
      render(ChipGroup, {
        props: { items, select: 'single', mode: 'tabs', value: 'spring', ariaLabel: 'Status' }
      });

      const tablist = screen.getByRole('tablist', { name: 'Status' });
      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs).toHaveLength(3);

      expect(screen.getByRole('tab', { name: 'Spring' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Winter' })).toHaveAttribute('aria-selected', 'false');

      // Roving: only the selected tab is reachable by Tab.
      expect(screen.getByRole('tab', { name: 'Spring' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: 'Winter' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('tab', { name: 'Summer' })).toHaveAttribute('tabindex', '-1');
    });

    it('falls back to the first tab as the tab stop when nothing is selected', () => {
      render(ChipGroup, { props: { items, select: 'single', mode: 'tabs', ariaLabel: 'Status' } });

      expect(screen.getByRole('tab', { name: 'Winter' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: 'Spring' })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('keyboard', () => {
    it('arrow keys move the selection in a single-select row', async () => {
      const onSelect = vi.fn();
      render(ChipGroup, {
        props: { items, select: 'single', mode: 'tabs', value: 'winter', onSelect, ariaLabel: 'Season' }
      });

      screen.getByRole('tab', { name: 'Winter' }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onSelect).toHaveBeenCalledWith('spring');
      expect(screen.getByRole('tab', { name: 'Spring' })).toHaveFocus();
    });

    it('wraps at the ends, per the ARIA tabs pattern', async () => {
      const onSelect = vi.fn();
      render(ChipGroup, {
        props: { items, select: 'single', mode: 'tabs', value: 'winter', onSelect, ariaLabel: 'Season' }
      });

      screen.getByRole('tab', { name: 'Winter' }).focus();
      await userEvent.keyboard('{ArrowLeft}');

      expect(onSelect).toHaveBeenCalledWith('summer');
    });

    it('Home and End jump to the ends', async () => {
      const onSelect = vi.fn();
      render(ChipGroup, {
        props: { items, select: 'single', mode: 'tabs', value: 'spring', onSelect, ariaLabel: 'Season' }
      });

      screen.getByRole('tab', { name: 'Spring' }).focus();
      await userEvent.keyboard('{End}');
      expect(onSelect).toHaveBeenLastCalledWith('summer');

      await userEvent.keyboard('{Home}');
      expect(onSelect).toHaveBeenLastCalledWith('winter');
    });

    it('skips a disabled chip', async () => {
      const onSelect = vi.fn();
      render(ChipGroup, {
        props: {
          items: [
            { value: 'winter', label: 'Winter' },
            { value: 'spring', label: 'Spring', disabled: true },
            { value: 'summer', label: 'Summer' }
          ],
          select: 'single',
          mode: 'tabs',
          value: 'winter',
          onSelect,
          ariaLabel: 'Season'
        }
      });

      screen.getByRole('tab', { name: 'Winter' }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onSelect).toHaveBeenCalledWith('summer');
    });

    /**
     * A11y REGRESSION. In a multi-select row an arrow key must not toggle a
     * filter on: the chips are independent toggles, not a roving set, so the
     * arrows belong to the browser.
     */
    it('arrow keys do NOT move or change the selection in a multi-select row', async () => {
      const onSelect = vi.fn();
      const selected = new Set(['winter']);
      render(ChipGroup, {
        props: {
          items,
          select: 'multi',
          isSelected: (v: string) => selected.has(v),
          onSelect,
          ariaLabel: 'Filter by season'
        }
      });

      const first = screen.getByRole('button', { name: 'Winter' });
      first.focus();
      await userEvent.keyboard('{ArrowRight}{ArrowDown}{Home}{End}');

      expect(onSelect).not.toHaveBeenCalled();
      expect(first).toHaveFocus();
    });
  });

  describe('multi-select', () => {
    it('marks every chip with aria-pressed and toggles on click', async () => {
      const onSelect = vi.fn();
      const selected = new Set(['spring']);
      render(ChipGroup, {
        props: {
          items,
          select: 'multi',
          isSelected: (v: string) => selected.has(v),
          onSelect,
          ariaLabel: 'Filter by season'
        }
      });

      expect(screen.getByRole('button', { name: 'Spring' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Winter' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.queryAllByRole('tab')).toHaveLength(0);

      await userEvent.click(screen.getByRole('button', { name: 'Summer' }));
      expect(onSelect).toHaveBeenCalledWith('summer');
    });
  });

  describe('select="none" -- the link row', () => {
    /** REGRESSION: a chip with an href renders an <a>, not a button. */
    it('renders links, not buttons', () => {
      render(ChipGroup, {
        props: {
          items: [
            { value: 'action', label: 'Action', href: '/genre/action' },
            { value: 'drama', label: 'Drama', href: '/genre/drama' }
          ],
          select: 'none'
        }
      });

      expect(screen.getByRole('link', { name: 'Action' })).toHaveAttribute(
        'href',
        '/genre/action'
      );
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('is not a landmark at all when it selects nothing and names nothing', () => {
      const { container } = render(ChipGroup, {
        props: { items: [{ label: 'Action', href: '/genre/action' }], select: 'none' }
      });

      expect(container.querySelector('.chipgroup')).not.toHaveAttribute('role');
    });

    it('becomes a named group once it is given a label', () => {
      render(ChipGroup, {
        props: {
          items: [{ label: 'Action', href: '/genre/action' }],
          select: 'none',
          ariaLabel: 'Genres'
        }
      });

      expect(screen.getByRole('group', { name: 'Genres' })).toBeInTheDocument();
    });
  });

  describe('counts, icons and affordances', () => {
    it('renders a count beside the label', () => {
      render(ChipGroup, {
        props: {
          items: [{ value: 'action', label: 'Action', count: 42 }],
          select: 'multi',
          ariaLabel: 'Genres'
        }
      });

      const chip = screen.getByRole('button', { name: /Action/ });
      expect(chip).toHaveTextContent('Action');
      expect(chip).toHaveTextContent('42');
    });

    it('an icon-only chip is named by its title -- never nameless', () => {
      render(ChipGroup, {
        props: {
          items: [
            { value: 'grid', label: 'Grid', title: 'Grid view' },
            { value: 'list', label: 'List', title: 'List view' }
          ],
          select: 'single',
          mode: 'toggle',
          iconOnly: true,
          value: 'grid',
          ariaLabel: 'Layout'
        }
      });

      expect(screen.getByRole('button', { name: 'Grid view' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'List view' })).toBeInTheDocument();
      // The label itself is not drawn, so the accessible name is all there is.
      expect(screen.queryByText('Grid')).not.toBeInTheDocument();
    });

    it('draws a Clear chip that calls back', async () => {
      const onClear = vi.fn();
      render(ChipGroup, {
        props: { items, select: 'multi', clear: { onClear }, ariaLabel: 'Genres' }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('draws "+N more" while something is hidden, and calls back', async () => {
      const onToggle = vi.fn();
      render(ChipGroup, {
        props: {
          items,
          select: 'multi',
          more: { hiddenCount: 12, expanded: false, onToggle },
          ariaLabel: 'Genres'
        }
      });

      await userEvent.click(screen.getByRole('button', { name: '+12 more' }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('a one-way reveal drops the chip once expanded', () => {
      render(ChipGroup, {
        props: {
          items,
          select: 'multi',
          more: { hiddenCount: 12, expanded: true, onToggle: () => {} },
          ariaLabel: 'Genres'
        }
      });

      expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
    });

    it('a reversible reveal swaps to the collapse label', () => {
      render(ChipGroup, {
        props: {
          items,
          select: 'multi',
          more: {
            hiddenCount: 12,
            expanded: true,
            collapseLabel: 'Show less',
            onToggle: () => {}
          },
          ariaLabel: 'Genres'
        }
      });

      expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    });

    it('renders nothing but the container when it has no items', () => {
      render(ChipGroup, { props: { items: [], select: 'multi', ariaLabel: 'Genres' } });

      const group = screen.getByRole('group', { name: 'Genres' });
      expect(within(group).queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('skins', () => {
    it('carries the variant class the CSS keys on, on the row and on every chip', () => {
      const { container } = render(ChipGroup, {
        props: { items, select: 'single', mode: 'tabs', variant: 'underline', ariaLabel: 'Status' }
      });

      expect(container.querySelector('.chipgroup')).toHaveClass('chipgroup--underline');
      expect(screen.getByRole('tab', { name: 'Winter' })).toHaveClass('cg-item--underline');
    });

    /**
     * REGRESSION. `segmented` -- a grey container, a solid-filled active chip --
     * was a second visual language for the job `pill` already did, and merged
     * into it. Every row that picks is a pill now, and a row that names no
     * variant gets one, so a mode switch cannot quietly grow a container again.
     */
    it('defaults to pill, the one treatment for a row that picks', () => {
      const { container } = render(ChipGroup, {
        props: { items, select: 'single', mode: 'toggle', ariaLabel: 'Season' }
      });

      const row = container.querySelector('.chipgroup');
      expect(row).toHaveClass('chipgroup--pill');
      expect(row?.className).not.toMatch(/segmented/);
      expect(screen.getByRole('button', { name: 'Winter' })).toHaveClass('cg-item--pill');
    });

    /**
     * The one thing the retired container did by construction: hold the strip
     * on a single line. Five statuses or twelve years wrapped onto three lines
     * push a phone's content off the first screen, so the row scrolls inside
     * itself instead -- which leaves documentElement's own width alone.
     */
    it('nowrap marks the row the one-line scroll keys on', () => {
      const { container } = render(ChipGroup, {
        props: { items, select: 'single', mode: 'toggle', nowrap: true, ariaLabel: 'Season' }
      });

      expect(container.querySelector('.chipgroup')).toHaveClass('chipgroup--nowrap');
    });

    it('leaves the row free to wrap by default', () => {
      const { container } = render(ChipGroup, {
        props: { items, select: 'multi', ariaLabel: 'Genres' }
      });

      expect(container.querySelector('.chipgroup')).not.toHaveClass('chipgroup--nowrap');
    });

    it('touch is a height, not a type scale -- the chips stay at the default size', () => {
      const { container } = render(ChipGroup, {
        props: { items, select: 'single', mode: 'toggle', size: 'touch', ariaLabel: 'Season' }
      });

      expect(container.querySelector('.chipgroup')).toHaveClass('chipgroup--touch');
      const chip = screen.getByRole('button', { name: 'Winter' });
      expect(chip).toHaveClass('chip--md', 'chip--touch');
      expect(chip).not.toHaveClass('chip--sm');
    });
  });
});
