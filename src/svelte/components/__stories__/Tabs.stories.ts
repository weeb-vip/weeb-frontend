import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import { faList, faTableCells, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import Tabs, { type TabItem } from '../Tabs.svelte';

const STATUS_TABS: TabItem[] = [
  { value: 'watching', label: 'Watching', count: 14 },
  { value: 'completed', label: 'Completed', count: 132 },
  { value: 'planned', label: 'Plan to Watch', count: 61 },
  { value: 'onhold', label: 'On Hold', count: 0 },
  { value: 'dropped', label: 'Dropped', count: 0 },
];

const VIEW_TABS: TabItem[] = [
  { value: 'list', label: 'List view', icon: faList, title: 'List view' },
  { value: 'grid', label: 'Grid view', icon: faTableCells, title: 'Grid view' },
];

/** The pages use inline SVGs rather than FontAwesome; `itemContent` is how they keep them. */
const svgItem = createRawSnippet((item: () => TabItem) => ({
  render: () =>
    item().value === 'schedule'
      ? `<span style="display:inline-flex;align-items:center;gap:6px;">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>
           Schedule
         </span>`
      : `<span style="display:inline-flex;align-items:center;gap:6px;">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
           Calendar
         </span>`,
}));

const meta = {
  title: 'Primitives/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The profile status tabs: underline skin, count pills, and a muted zero on the empty statuses. */
export const UnderlineWithCounts: Story = {
  args: {
    items: STATUS_TABS,
    value: 'watching',
    onChange: () => {},
    variant: 'underline',
    ariaLabel: 'Filter by status',
  },
};

/** More tabs than fit: the strip scrolls sideways rather than wrapping or squashing. */
export const UnderlineOverflowing: Story = {
  args: {
    items: [
      ...STATUS_TABS,
      { value: 'rewatching', label: 'Rewatching', count: 3 },
      { value: 'favourites', label: 'Favourites', count: 28 },
      { value: 'recommended', label: 'Recommended', count: 9 },
    ],
    value: 'completed',
    onChange: () => {},
    variant: 'underline',
    ariaLabel: 'Filter by status',
  },
};

/** ProfileList's anime/manga switch: a compact segmented control with the active side filled. */
export const Segmented: Story = {
  args: {
    items: [
      { value: 'anime', label: 'Anime' },
      { value: 'manga', label: 'Manga' },
    ],
    value: 'anime',
    onChange: () => {},
    variant: 'segmented',
    ariaLabel: 'Anime or manga',
  },
};

/** CurrentlyAiringPage's schedule/calendar switch, keeping its own inline SVGs via `itemContent`. */
export const SegmentedWithCustomContent: Story = {
  args: {
    items: [
      { value: 'schedule', label: 'Schedule' },
      { value: 'calendar', label: 'Calendar', icon: faCalendarDays },
    ],
    value: 'schedule',
    onChange: () => {},
    variant: 'segmented',
    ariaLabel: 'View mode',
    itemContent: svgItem,
  },
};

/** Grid/list mode: `toggle` mode, so these are pressed buttons rather than tabs, each named by its title. */
export const IconOnlyToggle: Story = {
  args: {
    items: VIEW_TABS,
    value: 'grid',
    onChange: () => {},
    variant: 'segmented',
    mode: 'toggle',
    iconOnly: true,
    ariaLabel: 'View mode',
  },
};

/** CharactersWithStaff's filter row: pills that wrap over as many lines as they need. */
export const Pills: Story = {
  args: {
    items: [
      { value: 'all', label: 'All' },
      { value: 'main', label: 'Main' },
      { value: 'supporting', label: 'Supporting' },
      { value: 'japanese', label: 'Japanese VA' },
      { value: 'english', label: 'English VA' },
    ],
    value: 'main',
    onChange: () => {},
    variant: 'pill',
    ariaLabel: 'Filter characters',
  },
};

/** A disabled item is skipped by both the pointer and the arrow keys. */
export const WithDisabledItem: Story = {
  args: {
    items: [
      { value: 'anime', label: 'Anime' },
      { value: 'manga', label: 'Manga' },
      { value: 'novels', label: 'Novels', disabled: true },
    ],
    value: 'anime',
    onChange: () => {},
    variant: 'segmented',
    ariaLabel: 'Medium',
  },
};
