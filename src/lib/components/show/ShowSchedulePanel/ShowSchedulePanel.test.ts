import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ShowSchedulePanel from './ShowSchedulePanel.svelte';

/**
 * When the next episode airs, and nothing else.
 *
 * The regression this suite pins is that the panel renders from RESOLVED props
 * alone. It used to compute its own timing from a client-only worker, so on the
 * server render there was no timing yet and the panel did not exist -- the
 * first paint of every show page was missing its schedule. Every test below
 * mounts it with plain strings and nothing else: no worker, no clock, no
 * client-only guard. If one is ever reintroduced, these stop rendering.
 */

const base = {
  label: 'Next episode',
  countdown: '3h',
  episodeNumber: '12',
  localTime: 'Fri 6:00 AM',
  localZone: 'PST',
  broadcastSlot: 'Fridays at 23:00 (JST)',
  open: false,
  onToggle: () => {},
  onClose: () => {}
};

describe('ShowSchedulePanel', () => {
  describe('rendering from resolved timing alone', () => {
    it('renders the whole panel from strings, with no client-only dependency', () => {
      render(ShowSchedulePanel, { props: base });

      const panel = screen.getByRole('complementary', { name: 'Broadcast schedule' });
      expect(panel).toBeInTheDocument();
      expect(screen.getByText('Next episode')).toBeInTheDocument();
      expect(screen.getByText('3h')).toBeInTheDocument();
      expect(screen.getByText('EP 12')).toBeInTheDocument();
      expect(panel).toHaveTextContent('Fri 6:00 AM');
      expect(panel).toHaveTextContent('PST');
    });

    it('renders on the very first frame -- nothing is gated behind an effect', () => {
      // No `await tick()`, no `waitFor`: the assertion runs against the
      // synchronous mount. A worker-fed panel could not satisfy this.
      const { container } = render(ShowSchedulePanel, { props: base });

      expect(container.querySelector('.hero-aside')).toBeInTheDocument();
      expect(container.querySelector('.hero-next-countdown')?.textContent).toBe('3h');
    });

    it.each([
      ['Airing now', '12m left'],
      ['Recently aired', ''],
      ['Next episode', '3h']
    ])('renders the "%s" state the page resolved', (label, countdown) => {
      render(ShowSchedulePanel, { props: { ...base, label, countdown } });

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('parts with nothing to say are absent', () => {
    it('drops the countdown when the episode is further out than a day', () => {
      const { container } = render(ShowSchedulePanel, { props: { ...base, countdown: '' } });

      expect(container.querySelector('.hero-next-countdown')).toBeNull();
      // The date is still all the panel can honestly offer, and it stays.
      expect(screen.getByText('Next episode')).toBeInTheDocument();
      expect(container).toHaveTextContent('Fri 6:00 AM');
    });

    it('drops the episode chip when the number is unknown', () => {
      render(ShowSchedulePanel, { props: { ...base, episodeNumber: '' } });

      expect(screen.queryByText(/^EP /)).not.toBeInTheDocument();
    });

    it('drops the local time, and the zone with it, when there is no slot to convert', () => {
      const { container } = render(ShowSchedulePanel, {
        props: { ...base, localTime: '', localZone: '' }
      });

      expect(container.querySelector('.hero-next-when')).toBeNull();
    });

    it('shows the time without a zone marker when the zone is unknown', () => {
      const { container } = render(ShowSchedulePanel, { props: { ...base, localZone: '' } });

      expect(container.querySelector('.hero-next-when')).toHaveTextContent('Fri 6:00 AM');
      expect(container.querySelector('.hero-next-zone')).toBeNull();
    });

    it('renders the label alone when that is genuinely all there is', () => {
      render(ShowSchedulePanel, {
        props: {
          label: 'Next episode',
          onToggle: () => {},
          onClose: () => {}
        }
      });

      const panel = screen.getByRole('complementary', { name: 'Broadcast schedule' });
      expect(panel).toHaveTextContent('Next episode');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('the broadcast-slot popover', () => {
    it('offers no toggle at all for a show whose slot the API never recorded', () => {
      render(ShowSchedulePanel, { props: { ...base, broadcastSlot: null } });

      expect(screen.queryByRole('button', { name: 'Broadcast time' })).not.toBeInTheDocument();
    });

    it('is a collapsed, wired-up disclosure while closed', () => {
      render(ShowSchedulePanel, { props: base });

      const toggle = screen.getByRole('button', { name: 'Broadcast time' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', 'show-broadcast-slot');
      expect(document.getElementById('show-broadcast-slot')).toBeNull();
    });

    it('calls back rather than opening itself -- the page owns the state', async () => {
      const onToggle = vi.fn();
      render(ShowSchedulePanel, { props: { ...base, onToggle } });

      await userEvent.click(screen.getByRole('button', { name: 'Broadcast time' }));

      expect(onToggle).toHaveBeenCalledTimes(1);
      // Still closed: `open` is a prop, so a controlled component must not
      // flip it behind the page's back.
      expect(screen.getByRole('button', { name: 'Broadcast time' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    });

    it('shows the original Japanese slot and says the times were converted', () => {
      render(ShowSchedulePanel, { props: { ...base, open: true } });

      const note = screen.getByRole('note');
      expect(note).toHaveAttribute('id', 'show-broadcast-slot');
      expect(note).toHaveTextContent('Fridays at 23:00 (JST)');
      expect(note).toHaveTextContent('Times above are converted to your local timezone.');
      expect(screen.getByRole('button', { name: 'Broadcast time' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('stays closed when it is open but there is no slot to show', () => {
      render(ShowSchedulePanel, { props: { ...base, open: true, broadcastSlot: null } });

      expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    it('closes on a click outside itself', async () => {
      const onClose = vi.fn();
      render(ShowSchedulePanel, { props: { ...base, open: true, onClose } });

      await userEvent.click(document.body);

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close on a click inside the popover', async () => {
      const onClose = vi.fn();
      render(ShowSchedulePanel, { props: { ...base, open: true, onClose } });

      await userEvent.click(screen.getByText('Fridays at 23:00 (JST)'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close on the trigger, which would reopen-and-close on one click', async () => {
      const onClose = vi.fn();
      render(ShowSchedulePanel, { props: { ...base, open: true, onClose } });

      await userEvent.click(screen.getByRole('button', { name: 'Broadcast time' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    /**
     * The popover is `position: fixed` and anchored to the trigger because the
     * hero clips its own overflow. jsdom reports every rect as 0x0 and applies
     * no stylesheet, so where it actually lands is a browser fact -- only the
     * fact that it is taken out of the panel's flow is assertable here.
     */
    it('is rendered outside the panel, not inside the aside that clips it', () => {
      render(ShowSchedulePanel, { props: { ...base, open: true } });

      const aside = screen.getByRole('complementary', { name: 'Broadcast schedule' });
      expect(aside.contains(screen.getByRole('note'))).toBe(false);
    });
  });
});
