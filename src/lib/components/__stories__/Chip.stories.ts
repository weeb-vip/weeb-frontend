import type { Meta, StoryObj } from '@storybook/svelte';
import Chip from '$lib/components/primitives/Chip.svelte';

/**
 * THE pill. Genre links, quick-info facts, type badges, news categories and
 * voice-actor credits are all this one component, so the `--weeb-pill-*` tokens
 * are read in exactly one file.
 *
 * It renders as an `<a>` given an `href`, a `<button>` given an `onclick`, and
 * a `<span>` otherwise -- which is what lets a link row and a static badge be
 * the same thing.
 */
const meta = {
  title: 'Primitives/Chip',
  component: Chip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'accent', 'green', 'amber', 'red'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plain static badge: a `<span>`, no hover, no target. */
export const Neutral: Story = {
  args: { label: 'Action' },
};

/** A tone states something, and carries its colour at rest. */
export const Accent: Story = {
  args: { label: 'Announcement', tone: 'accent' },
};

/** Green is airing and success; amber is upcoming and warning. */
export const Green: Story = {
  args: { label: 'Airing', tone: 'green', dot: true },
};

/** Amber never means "airing now" -- that clash is what AiringIndicator fixed. */
export const Amber: Story = {
  args: { label: 'in 2d', tone: 'amber', mono: true },
};

/** The dense size, for a badge beside a title in a metadata row. 11px. */
export const Small: Story = {
  args: { label: 'MANGA', size: 'sm' },
};

/** With an `href` it is an anchor, and it lights up on hover and focus. */
export const AsLink: Story = {
  args: { label: 'Fantasy', href: '/search?genre=Fantasy' },
};

/** The touch height, for a row that is a page's primary way through it. */
export const TouchLink: Story = {
  args: { label: 'Slice of Life', href: '/search?genre=Slice%20of%20Life', touch: true },
};

/** With an `onclick` it is a button. This is the shape `ChipGroup` builds its rows from. */
export const Selectable: Story = {
  args: { label: 'Currently airing', onclick: () => {}, selected: true, count: 128, ariaPressed: true },
};

/** The count badge, unselected, with an empty facet beside it at `0`. */
export const WithCount: Story = {
  args: { label: 'Completed', onclick: () => {}, count: 0 },
};

/** A colour the tones cannot name -- for an open set like news categories. */
export const CustomColor: Story = {
  args: { label: 'reception', size: 'sm', color: 'var(--weeb-violet)' },
};

/** An inert control. */
export const Disabled: Story = {
  args: { label: 'Unavailable', onclick: () => {}, disabled: true },
};
