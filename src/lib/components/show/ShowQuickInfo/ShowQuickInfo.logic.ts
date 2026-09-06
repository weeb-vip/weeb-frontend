import type { SelectOption } from '$lib/components/primitives/Select';

/**
 * The score picker's options. `Select` takes its options as data; the blank one
 * is "no score yet", which is what the native <select>'s empty <option> was.
 */
const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export const SCORE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Score' },
  ...SCORES.map((value) => ({ value, label: String(value) }))
];
