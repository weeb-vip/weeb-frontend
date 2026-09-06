import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import { faFaceFrown, faBookmark } from '@fortawesome/free-solid-svg-icons';
import EmptyState from './EmptyState.svelte';

/**
 * The pages hand in inline SVGs rather than FontAwesome icons, so the stories
 * do too -- `createRawSnippet` builds one from a plain .ts file.
 */
const searchIcon = createRawSnippet(() => ({
  render: () => `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>`,
}));

/** SeasonPage's failure glyph. A magnifier would claim the search came back empty. */
const brokenCircle = createRawSnippet(() => ({
  render: () => `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
    </svg>`,
}));

const filteredCopy = createRawSnippet(() => ({
  render: () => `<span>No anime match the selected tags.</span>`,
}));

const meta = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The plainest form: one line of muted copy, no icon and no action (CurrentlyAiringPage, WorksBrowsePage). */
export const MessageOnly: Story = {
  args: {
    message: 'No upcoming airing anime found.',
    size: 'compact',
  },
};

/** SearchPage's no-results state: inline SVG, heading, and a nudge about what to change. */
export const WithIconAndHeading: Story = {
  args: {
    icon: searchIcon,
    heading: 'No results found',
    message: 'Try adjusting your filters or search term.',
  },
};

/** ProfileAnimeList: the icon sits in a surface disc, and the CTA sends you somewhere to fix it. */
export const WithCircleIconAndLinkAction: Story = {
  args: {
    icon: faFaceFrown,
    iconFrame: 'circle',
    heading: 'No anime in watching',
    message: 'Start building your list by browsing anime and adding them to your watchlist.',
    action: { label: 'Browse Anime', href: '/' },
  },
};

/** CurrentlyAiringPage's filtered-to-nothing state: a ghost button that undoes the filter in place. */
export const WithGhostAction: Story = {
  args: {
    message: 'No anime from your list are airing in this period.',
    action: { label: 'Show all anime', variant: 'ghost', onClick: () => {} },
    size: 'compact',
  },
};

/** ProfilePage's bordered panel, with the second supporting line the sections use. */
export const PanelWithDetail: Story = {
  args: {
    variant: 'panel',
    icon: faBookmark,
    message: "You're not currently watching any anime",
    detail: 'Start watching something new from your plan to watch list',
  },
};

/** The full-width version ProfilePage shows when the whole watchlist is empty. */
export const Hero: Story = {
  args: {
    variant: 'panel',
    size: 'hero',
    icon: faBookmark,
    heading: 'Your watchlist is empty',
    message:
      'Start adding anime to your watchlist to see personalized recommendations and airing schedules.',
    action: { label: 'Explore Anime', href: '/' },
  },
};

/** SeasonPage puts a "clear filters" control inside the body copy -- that goes through the children snippet. */
export const WithBodySnippet: Story = {
  args: {
    icon: searchIcon,
    heading: 'No anime found',
    children: filteredCopy,
    action: { label: 'Clear filters', variant: 'ghost', onClick: () => {} },
  },
};

/**
 * The failure variant of the same surface, as SeasonPage actually renders it
 * when the SSR fetch errored.
 *
 * The story used to show a magnifying glass and no action -- which says "no
 * results" about a request that failed, and leaves the reader with no way out.
 * A failed fetch gets the broken-circle glyph and the retry the route has
 * always passed: an EmptyState with no `action` is not a legitimate error state.
 */
export const ErrorShaped: Story = {
  args: {
    icon: brokenCircle,
    heading: 'Something went wrong',
    message: 'We could not reach the season index. Try again in a moment.',
    size: 'hero',
    action: { label: 'Try again', variant: 'ghost', onClick: () => {} },
  },
};
