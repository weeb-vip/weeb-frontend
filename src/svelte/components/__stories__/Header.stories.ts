import type { Meta, StoryObj } from '@storybook/svelte';
import { readable } from 'svelte/store';
import Header from '../../../lib/Header.svelte';
import { HeaderBloc, type FramePort } from '../../../lib/Header.bloc.svelte';

/**
 * Header takes a bloc; its four chrome children do not, and between them they
 * run a GraphQL user query, fetch /config.json and stand up an Algolia client.
 * Header itself is out of scope for this story to change, so the substitution
 * happens one level down: `.storybook/main.ts` resolves AuthInitializer,
 * LoginModalHandler, UserProfileHandler and AutocompleteAdvanced to the offline
 * stand-ins in `./offline/` **only for imports made by Header.svelte** -- every
 * other consumer, including AutocompleteAdvanced's own story, gets the real
 * module. Two of those stand-ins render the real component behind them with
 * stub ports, so the bar on screen here is the bar the app draws.
 *
 * No real frames either: the easing loop would keep scheduling work behind the
 * docs page. Every story renders one settled value instead.
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
  title: 'Composites/App Shell/Header',
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
