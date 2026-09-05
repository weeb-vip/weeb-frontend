import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import Header from '../../../lib/Header.svelte';
import { HeaderBloc, type FramePort } from '../../../lib/Header.bloc.svelte';

/**
 * No real frames: the easing loop would keep scheduling work behind the docs
 * page. Every story renders one settled value instead.
 */
const noFrames: FramePort = { request: () => 0, cancel: () => {} };

function stubBloc(options: { overlay?: boolean; pathname?: string; scrolledTo?: number } = {}) {
  const bloc = new HeaderBloc({
    overlay: options.overlay ?? false,
    route: readable(options.pathname ?? '/'),
    frames: noFrames,
    // Reduced motion makes `scrolled` land on its target immediately, which is
    // how a static story can show a half-solid bar at all.
    prefersReducedMotion: () => true,
  });
  if (options.scrolledTo !== undefined) bloc.scrolled(options.scrolledTo);

  return bloc;
}

const meta = {
  title: 'Design System/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary bar: glass from the first pixel, on a page with no artwork behind it. */
export const Solid: Story = {
  args: {
    ssrAuth: null,
    overlay: false,
    bloc: stubBloc(),
  },
};

/** An overlay page at the top of the scroll: the bar has dissolved into the key art. */
export const OverlayAtTop: Story = {
  args: {
    ssrAuth: null,
    overlay: true,
    bloc: stubBloc({ overlay: true, scrolledTo: 0 }),
  },
};

/** Mid-scroll on an overlay page: the glass is halfway back, which is the state that used to pop. */
export const OverlayMidScroll: Story = {
  args: {
    ssrAuth: null,
    overlay: true,
    bloc: stubBloc({ overlay: true, scrolledTo: 110 }),
  },
};

/** Scrolled past the fade distance: indistinguishable from the solid bar. */
export const OverlayScrolled: Story = {
  args: {
    ssrAuth: null,
    overlay: true,
    bloc: stubBloc({ overlay: true, scrolledTo: 400 }),
  },
};

/** On /manga, so that nav item is marked current -- including from a detail URL. */
export const CurrentSectionMarked: Story = {
  args: {
    ssrAuth: null,
    overlay: false,
    bloc: stubBloc({ pathname: '/manga/spice-and-wolf' }),
  },
};
