import type { Meta, StoryObj } from '@storybook/svelte';
import ChapterProgress from '../ChapterProgress.svelte';
import {
  ChapterProgressBloc,
  type UserWorkProgress,
  type WorkProgressPort,
} from '../ChapterProgress.bloc.svelte';

/** Writes that land instantly and never reach the network. */
const accepting: WorkProgressPort = { save: async () => ({}) };

/** A write that never settles, so the stepper stays disabled after a step. */
const stalled: WorkProgressPort = { save: () => new Promise(() => {}) };

function bloc(
  totalChapters: number | null,
  userWork: UserWorkProgress | null,
  progress = accepting,
) {
  return new ChapterProgressBloc({
    work: () => ({ workId: 'work-1', totalChapters, userWork }),
    progress,
    refresh: async () => {},
    notify: { error: (message) => console.info('[toast]', message) },
  });
}

const meta = {
  title: 'Composites/Tracking/ChapterProgress',
  component: ChapterProgress,
  tags: ['autodocs'],
} satisfies Meta<typeof ChapterProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Just added: nothing read, so the minus step is inert. */
export const NotStarted: Story = {
  args: {
    workId: 'work-1',
    totalChapters: 139,
    userWork: { status: 'READING', chapters: 0 },
    bloc: bloc(139, { status: 'READING', chapters: 0 }),
  },
};

/** Part way through -- the bar is the only thing that says how far. */
export const PartWayThrough: Story = {
  args: {
    workId: 'work-1',
    totalChapters: 139,
    userWork: { status: 'READING', chapters: 74 },
    bloc: bloc(139, { status: 'READING', chapters: 74 }),
  },
};

/** At the end: the plus step is inert, because there is nothing further to read. */
export const Finished: Story = {
  args: {
    workId: 'work-1',
    totalChapters: 139,
    userWork: { status: 'COMPLETED', chapters: 139 },
    bloc: bloc(139, { status: 'COMPLETED', chapters: 139 }),
  },
};

/**
 * An ongoing work whose total was never recorded. No bar and no ceiling -- the
 * count just goes up.
 */
export const NoKnownTotal: Story = {
  args: {
    workId: 'work-1',
    totalChapters: null,
    userWork: { status: 'READING', chapters: 312 },
    bloc: bloc(null, { status: 'READING', chapters: 312 }),
  },
};

/** Stepping here leaves a write in flight for good, which is what a slow save looks like. */
export const SaveInFlight: Story = {
  args: {
    workId: 'work-1',
    totalChapters: 139,
    userWork: { status: 'READING', chapters: 12 },
    bloc: bloc(139, { status: 'READING', chapters: 12 }, stalled),
  },
};
