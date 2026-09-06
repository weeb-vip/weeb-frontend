/**
 * Chip's vocabulary and its class/style decisions.
 *
 * The view draws a pill; which pill it is -- the tint, whether the chip has a
 * colour of its own at all, and the class list that follows from that -- is
 * decided here, so the markup reads as three elements and a snippet.
 */

/**
 * The one tone vocabulary a chip can speak in. `neutral` is the plain
 * surface chip; every other tone tints border, text and ground from a single
 * colour so the whole family is one rule with one variable in it.
 */
export type ChipTone = 'neutral' | 'accent' | 'green' | 'amber' | 'red';

/** 11px for dense metadata rows, 12px (the pill token) everywhere else. */
export type ChipSize = 'sm' | 'md';

const TONE_COLORS: Record<ChipTone, string> = {
  neutral: 'var(--weeb-accent)',
  accent: 'var(--weeb-accent)',
  green: 'var(--weeb-green)',
  amber: 'var(--weeb-amber)',
  red: 'var(--weeb-red)'
};

/** What the whole family tints from: an explicit colour, else the tone's. */
export function chipColor(tone: ChipTone, color: string | undefined): string {
  return color ?? TONE_COLORS[tone];
}

/** The single custom property every chip rule reads. */
export function chipStyle(tone: ChipTone, color: string | undefined): string {
  return `--chip-color: ${chipColor(tone, color)};`;
}

/** Has a colour of its own -- which drives the dot and the selected wash. */
export function isColored(tone: ChipTone, color: string | undefined): boolean {
  return tone !== 'neutral' || color != null;
}

export interface ChipClassInput {
  tone: ChipTone;
  size: ChipSize;
  color: string | undefined;
  tintAtRest: boolean;
  ghost: boolean;
  touch: boolean;
  mono: boolean;
  selected: boolean;
  disabled: boolean;
  className: string;
}

export function chipClass(input: ChipClassInput): string {
  const colored = isColored(input.tone, input.color);
  return [
    'chip',
    `chip--${input.size}`,
    colored ? 'chip--colored' : '',
    colored && input.tintAtRest ? 'chip--toned' : '',
    input.ghost ? 'chip--ghost' : '',
    input.touch ? 'chip--touch' : '',
    input.mono ? 'chip--mono' : '',
    input.selected ? 'selected' : '',
    input.disabled ? 'is-disabled' : '',
    input.className
  ]
    .filter(Boolean)
    .join(' ');
}
