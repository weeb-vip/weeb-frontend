import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination.svelte';

/**
 * Prev / page-info / Next. `page` is zero-based at every call site; the label a
 * reader sees is `page + 1`, and it is announced -- the buttons themselves say
 * nothing about where you landed, so without the live region a keyboard user
 * paging with them hears silence.
 */

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

describe('Pagination', () => {
  it('names the nav landmark, so a page with two of them is navigable', () => {
    render(Pagination, {
      props: { page: 0, totalPages: 5, onPageChange: () => {}, label: 'Search results pages' }
    });

    expect(screen.getByRole('navigation', { name: 'Search results pages' })).toBeInTheDocument();
  });

  it('announces the one-based page in a polite live region', () => {
    const { container } = render(Pagination, {
      props: { page: 2, totalPages: 10, onPageChange: () => {} }
    });

    const info = container.querySelector('.pg-info') as HTMLElement;
    expect(info).toHaveAttribute('aria-live', 'polite');
    expect(info).toHaveTextContent('Page 3 of 10');
  });

  it('draws no page counter when there is only one page to be on', () => {
    const { container } = render(Pagination, {
      props: { page: 0, totalPages: 1, onPageChange: () => {} }
    });

    expect(container.querySelector('.pg-info')).toBeNull();
  });

  describe('paging', () => {
    it('steps back and forward in zero-based pages', async () => {
      const onPageChange = vi.fn();
      render(Pagination, { props: { page: 3, totalPages: 10, onPageChange } });

      await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(onPageChange).toHaveBeenLastCalledWith(4);

      await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenLastCalledWith(2);
    });

    it('is inert at the first page', async () => {
      const onPageChange = vi.fn();
      render(Pagination, { props: { page: 0, totalPages: 10, onPageChange } });

      const prev = screen.getByRole('button', { name: 'Previous page' });
      expect(prev).toBeDisabled();

      await userEvent.click(prev);
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('is inert at the last page', async () => {
      const onPageChange = vi.fn();
      render(Pagination, { props: { page: 9, totalPages: 10, onPageChange } });

      const next = screen.getByRole('button', { name: 'Next page' });
      expect(next).toBeDisabled();

      await userEvent.click(next);
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('names both buttons even though their visible labels drop on a phone', () => {
      render(Pagination, { props: { page: 1, totalPages: 5, onPageChange: () => {} } });

      // The visible words are hidden below 768px; the aria-label is what survives.
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });
  });

  describe('per page', () => {
    it('is not drawn unless the caller offers a choice', () => {
      render(Pagination, { props: { page: 0, totalPages: 5, onPageChange: () => {} } });

      expect(screen.queryByRole('button', { name: 'Results per page' })).not.toBeInTheDocument();
    });

    it('names itself, since the visible "Show ... per page" words cannot label a button', async () => {
      render(Pagination, {
        props: {
          page: 0,
          totalPages: 5,
          perPage: 25,
          perPageOptions: [25, 50, 100],
          onPageChange: () => {},
          onPerPageChange: () => {}
        }
      });

      const trigger = screen.getByRole('button', { name: 'Results per page' });
      expect(trigger).toHaveTextContent('25');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('reports the new size as a number, not the string the menu hands back', async () => {
      const onPerPageChange = vi.fn();
      render(Pagination, {
        props: {
          page: 0,
          totalPages: 5,
          perPage: 25,
          perPageOptions: [25, 50, 100],
          onPageChange: () => {},
          onPerPageChange
        }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Results per page' }));
      const listbox = await screen.findByRole('listbox', { name: 'Results per page' });
      await userEvent.click(within(listbox).getByRole('option', { name: '50' }));

      expect(onPerPageChange).toHaveBeenCalledWith(50);
      expect(onPerPageChange.mock.calls[0][0]).toBeTypeOf('number');
    });
  });
});
