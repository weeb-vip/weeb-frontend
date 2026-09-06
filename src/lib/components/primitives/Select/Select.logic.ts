/**
 * Select's vocabulary and its arithmetic: which option a value names, where the
 * menu goes so it stays on screen, and where an arrow key lands.
 *
 * The view keeps the DOM half -- portalling the menu, focusing, scrolling the
 * active row into view -- and reads the numbers from here.
 */

export type SelectOption = { value: string | number; label: string };

/**
 * Which control this is standing in for.
 *
 * `pill` is the dense filter control -- 32px, 16px radius, 13px/500 -- which
 * is the shape the search and airing filter rows want. `field` is the form
 * field: FormInput's 44px / radius-8 / 15px / 1.5px border, so a Select can
 * sit in a form row beside an input and read as the same control.
 *
 * There used to be only the pill, which is why four native <select>s -- and
 * their white OS menus -- survived in places a 32px filter pill could not go.
 */
export type SelectVariant = 'pill' | 'field';

/** The narrowest a menu is allowed to be, whatever the trigger's width. */
export const MENU_MIN_WIDTH = 180;
/** Gap below the trigger, and the margin the menu keeps from the viewport edge. */
const MENU_OFFSET = 6;
const VIEWPORT_MARGIN = 8;

/** Values arrive as numbers or strings from the same call sites; compare as text. */
export function optionIndexOf(options: SelectOption[], value: string | number): number {
  return options.findIndex((o) => String(o.value) === String(value));
}

export function selectedOption(
  options: SelectOption[],
  value: string | number
): SelectOption | undefined {
  return options.find((o) => String(o.value) === String(value));
}

/** Whether one row of the menu is the committed value. */
export function isSelectedOption(option: SelectOption, value: string | number): boolean {
  return String(option.value) === String(value);
}

/** The trigger's label: the selected option, or the placeholder when nothing matches. */
export function triggerLabel(
  options: SelectOption[],
  value: string | number,
  placeholder: string
): string {
  return selectedOption(options, value)?.label ?? placeholder;
}

export interface MenuPlacement {
  top: number;
  left: number;
  minWidth: number;
}

/**
 * Where the fixed-position menu sits. Right-aligned menus hang off the
 * trigger's right edge, and either way the menu is pulled back on screen: a
 * filter at the right-hand edge would otherwise open a menu that runs off the
 * page.
 */
export function menuPlacement(
  rect: { top: number; bottom: number; left: number; right: number; width: number },
  align: 'left' | 'right',
  viewportWidth: number
): MenuPlacement {
  const width = Math.max(rect.width, MENU_MIN_WIDTH);
  let left = align === 'right' ? rect.right - width : rect.left;

  if (left + width > viewportWidth - VIEWPORT_MARGIN) {
    left = viewportWidth - width - VIEWPORT_MARGIN;
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

  return { top: rect.bottom + MENU_OFFSET, left, minWidth: rect.width };
}

/**
 * Where an arrow key lands. Clamped rather than wrapping, which is what a
 * native select does; a first arrow-down from nowhere starts at the top.
 */
export function movedIndex(activeIndex: number, delta: number, count: number): number {
  if (count === 0) return activeIndex;
  const next = activeIndex < 0 ? 0 : activeIndex + delta;
  return Math.max(0, Math.min(count - 1, next));
}

/** Down, Up, Enter and Space all open a native select; matching that is what makes this feel like the control it replaced. */
export function opensMenu(key: string): boolean {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ';
}
