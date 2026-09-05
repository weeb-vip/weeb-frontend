import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileDropdown from '../ProfileDropdown.svelte';
import { ProfileDropdownBloc } from '../ProfileDropdown.bloc.svelte';

const user = {
  id: '1',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null,
};

const meta = {
  title: 'Composites/Profile/ProfileDropdown',
  component: ProfileDropdown,
  tags: ['autodocs'],
} satisfies Meta<typeof ProfileDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the avatar button on its own, which is all the header shows at rest. */
export const Closed: Story = {
  args: {
    user,
    bloc: new ProfileDropdownBloc(),
  },
};

/**
 * Open. The bloc is the seam that makes this reachable at all -- open/closed
 * used to be a local `let` that only a real click could flip.
 */
export const Open: Story = {
  args: {
    user,
    bloc: new ProfileDropdownBloc(true),
  },
};

/** Open with a name that overflows the menu, to check the truncation holds. */
export const OpenWithLongName: Story = {
  args: {
    user: {
      ...user,
      username: 'the-longest-username-anyone-has-ever-registered-here',
      firstname: 'Bartholomew Maximilian',
      lastname: 'Featherstonehaugh-Wollstonecraft',
    },
    bloc: new ProfileDropdownBloc(true),
  },
};
