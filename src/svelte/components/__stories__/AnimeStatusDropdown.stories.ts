import type { Meta, StoryObj } from '@storybook/svelte';
import AnimeStatusDropdown from '../AnimeStatusDropdown.svelte';
import {
  AnimeStatusDropdownBloc,
  type AnimeStatusDropdownEntry,
  type AnimeStatusDropdownVariant,
} from '../AnimeStatusDropdown.bloc.svelte';

/** The real port warms the GraphQL connection; a story has none to warm. */
const noQueryClient = { init: () => null };

const entry: AnimeStatusDropdownEntry = {
  id: 'user-anime-1',
  anime: { id: '154587' },
  status: 'WATCHING',
};

function bloc(
  overrides: Partial<AnimeStatusDropdownEntry> = {},
  variant: AnimeStatusDropdownVariant = 'default',
  buttonClassName = ''
) {
  return new AnimeStatusDropdownBloc(
    {
      entry: { ...entry, ...overrides },
      variant,
      buttonClassName,
      onStatusChange: (detail) => console.log('statusChange', detail),
      onDelete: (detail) => console.log('delete', detail),
    },
    { queryClient: noQueryClient }
  );
}

const meta = {
  title: 'Design System/AnimeStatusDropdown',
  component: AnimeStatusDropdown,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AnimeStatusDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger at rest, showing the entry's current status. */
export const Closed: Story = {
  args: {
    entry,
    bloc: bloc(),
  },
};

/**
 * Open. The menu is portalled to `<body>` and placed by `anchoredPosition`,
 * which measures it -- the old maths assumed a 280x200 box and misplaced
 * itself whenever that was wrong.
 */
export const Open: Story = {
  args: {
    entry,
    bloc: (() => {
      const instance = bloc();
      instance.toggleMenu();
      return instance;
    })(),
  },
};

/** An entry with no status yet: the trigger falls back to Plan to Watch. */
export const NoStatusYet: Story = {
  args: {
    entry,
    bloc: bloc({ status: undefined }),
  },
};

/** Completed, so the tick sits against a different row of the open menu. */
export const CompletedAndOpen: Story = {
  args: {
    entry,
    bloc: (() => {
      const instance = bloc({ status: 'COMPLETED' });
      instance.toggleMenu();
      return instance;
    })(),
  },
};

/** The list-row size. */
export const Compact: Story = {
  args: {
    entry,
    variant: 'compact',
    bloc: bloc({}, 'compact'),
  },
};

/** The banner size, over key art. */
export const Hero: Story = {
  args: {
    entry,
    variant: 'hero',
    bloc: bloc({}, 'hero'),
  },
};

/** The 32px kebab used on poster cards; its menu gets a "Change Status" header. */
export const IconOnly: Story = {
  args: {
    entry,
    variant: 'icon-only',
    bloc: bloc({}, 'icon-only'),
  },
};

/** A caller supplying its own button styling, which replaces the variant's. */
export const CustomButtonClass: Story = {
  args: {
    entry,
    buttonClassName: 'asd-btn--hero',
    bloc: bloc({}, 'default', 'asd-btn--hero'),
  },
};
