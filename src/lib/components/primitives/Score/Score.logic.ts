/**
 * A score is drawn to one decimal place, always -- 8 and 8.0 are the same
 * rating and must not be two different widths in a column of them. A value that
 * arrives already formatted (the API sends both) is passed through.
 */
export function scoreText(value: number | string | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(1) : (value ?? '');
}

/** Empty string counts as absent: an unrated show sends '' rather than null. */
export function hasScore(value: number | string | null | undefined): boolean {
  return value !== null && value !== undefined && value !== '';
}
