/**
 * Pagination's three decisions. `page` is zero-based at every call site; the
 * label a reader sees is `page + 1`, which is the view's business.
 */

export function hasPrev(page: number): boolean {
  return page > 0;
}

export function hasNext(page: number, totalPages: number): boolean {
  return page + 1 < totalPages;
}

/** The per-page select is drawn only when the caller offers a choice to make. */
export function showsPerPage(perPage: number | undefined, perPageOptions: number[]): boolean {
  return perPage !== undefined && perPageOptions.length > 0;
}

/** Select hands back `string | number`; a per-page that is not a number is not one. */
export function parsePerPage(value: string | number): number | null {
  const next = Number(value);
  return Number.isNaN(next) ? null : next;
}
