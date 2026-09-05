import type { Meta, StoryObj } from '@storybook/svelte';
import ShowSectionNav from '../ShowSectionNav.svelte';
import { sectionTabs } from '../ShowContent.rules';

const meta = {
  title: 'Show/ShowSectionNav',
  component: ShowSectionNav,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShowSectionNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const onSelect = (section: string) => console.log('select', section);

/** All four sections, with the counts that make the tabs worth reading. */
export const Populated: Story = {
  args: {
    sections: sectionTabs({ newsEnabled: true, newsCount: 12, episodeCount: 28 }),
    active: 'synopsis',
    onSelect,
  },
};

/** Scrolled into the episode list, so that tab is the one marked current. */
export const EpisodesActive: Story = {
  args: { ...Populated.args, active: 'episodes' },
};

/** The news flag off: the tab is gone, not disabled. */
export const NoNews: Story = {
  args: {
    sections: sectionTabs({ newsEnabled: false, newsCount: 12, episodeCount: 28 }),
    active: 'synopsis',
    onSelect,
  },
};

/** A show with nothing scraped: two tabs, both of which always have something. */
export const MinimalRecord: Story = {
  args: {
    sections: sectionTabs({ newsEnabled: true, newsCount: 0, episodeCount: 0 }),
    active: 'synopsis',
    onSelect,
  },
};

/** Offset down the page as it is when the compact header is showing above it. */
export const UnderTheStickyHeader: Story = {
  args: { ...Populated.args, top: 'calc(var(--weeb-nav-height, 60px) + 71px)' },
};
