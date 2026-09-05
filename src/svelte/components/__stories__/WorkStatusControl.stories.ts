import type { Meta, StoryObj } from '@storybook/svelte';
import WorkStatusControl from '../WorkStatusControl.svelte';
import {
  WorkStatusControlBloc,
  type UserWorkSnapshot,
  type WorkTrackingPort,
} from '../WorkStatusControl.bloc.svelte';

/** Writes that land instantly and never reach the network. */
const acceptingTracking: WorkTrackingPort = {
  setStatus: async () => ({}),
  untrack: async () => ({}),
};

/** The signed-out case: every write comes back as an access-denied. */
const refusingTracking: WorkTrackingPort = {
  setStatus: async () => {
    throw new Error('access denied');
  },
  untrack: async () => {
    throw new Error('access denied');
  },
};

function bloc(userWork: UserWorkSnapshot | null, tracking = acceptingTracking) {
  return new WorkStatusControlBloc({
    work: () => ({ workId: 'work-1', userWork }),
    tracking,
    // No page to invalidate and no toaster mounted in a story.
    refresh: async () => {},
    notify: { error: (message) => console.info('[toast]', message) },
  });
}

const meta = {
  title: 'Composites/Tracking/WorkStatusControl',
  component: WorkStatusControl,
  tags: ['autodocs'],
} satisfies Meta<typeof WorkStatusControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing on the shelf yet: the control sits on "Not tracking". */
export const NotTracking: Story = {
  args: {
    workId: 'work-1',
    userWork: null,
    bloc: bloc(null),
  },
};

/** An existing row. Picking another status writes it and holds the choice optimistically. */
export const Reading: Story = {
  args: {
    workId: 'work-1',
    userWork: { id: 'row-1', status: 'READING' },
    bloc: bloc({ id: 'row-1', status: 'READING' }),
  },
};

/** Finished. "Not tracking" in the same list is how the row gets removed. */
export const Completed: Story = {
  args: {
    workId: 'work-1',
    userWork: { id: 'row-1', status: 'COMPLETED' },
    bloc: bloc({ id: 'row-1', status: 'COMPLETED' }),
  },
};

/**
 * Every write is refused. Choosing a status rolls the control back to what the
 * server still believes, and the reason goes to the toaster.
 */
export const WritesRefused: Story = {
  args: {
    workId: 'work-1',
    userWork: { id: 'row-1', status: 'PLANTOREAD' },
    bloc: bloc({ id: 'row-1', status: 'PLANTOREAD' }, refusingTracking),
  },
};
