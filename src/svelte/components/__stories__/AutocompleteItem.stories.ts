import type { Meta, StoryObj } from '@storybook/svelte';
import AutocompleteItem from '../AutocompleteItem.svelte';

const meta = {
  title: 'Composites/App Shell/AutocompleteItem',
  component: AutocompleteItem,
  tags: ['autodocs'],
} satisfies Meta<typeof AutocompleteItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An anime hit: title and the year it started, nothing else. */
export const Anime: Story = {
  args: {
    item: {
      objectID: '1',
      id: '1',
      title_en: 'Chiikawa',
      title_jp: 'ちいかわ',
      start_date: '2022-04-04T00:00:00Z',
    },
    onClick: () => {},
  },
};

/** A works hit: tagged `__kind: work`, so it leads with what kind of thing it is. */
export const Work: Story = {
  args: {
    item: {
      objectID: 'w1',
      id: 'w1',
      __kind: 'work',
      type: 'LIGHT_NOVEL',
      title_en: 'Spice and Wolf',
      published_from: '2006-02-10T00:00:00Z',
    },
    onClick: () => {},
  },
};

/** The highlighted row -- what the arrow keys move through. */
export const Highlighted: Story = {
  args: {
    item: {
      objectID: '2',
      id: '2',
      title_en: 'Frieren: Beyond Journey\'s End',
      start_date: '2023-09-29T00:00:00Z',
    },
    active: true,
    onClick: () => {},
  },
};

/** A title far longer than the row: it truncates rather than wrapping the panel open. */
export const LongTitle: Story = {
  args: {
    item: {
      objectID: '3',
      id: '3',
      title_en:
        'The Detective Is Already Dead, and the Case Continues Regardless of How Long the Title Runs',
      start_date: '2021-07-04T00:00:00Z',
    },
    onClick: () => {},
  },
};

/** Only a Japanese title exists; the row falls back to it rather than rendering blank. */
export const JapaneseTitleOnly: Story = {
  args: {
    item: {
      objectID: '4',
      id: '4',
      title_jp: '呪術廻戦',
      start_date: '2020-10-03T00:00:00Z',
    },
    onClick: () => {},
  },
};
