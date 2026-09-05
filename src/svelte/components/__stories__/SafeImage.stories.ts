import type { Meta, StoryObj } from '@storybook/svelte';
import SafeImage from '../SafeImage.svelte';
import StoryContainer from './StoryContainer.svelte';

/**
 * SafeImage probes each candidate over the network with a per-attempt timeout,
 * so real URLs would make these stories slow and flaky. Inline data: sources
 * resolve (or fail) in the same tick and are passed through untouched.
 */
const POSTER =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0icmdiKDU4LDQ4LDkyKSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjE4MCIgcj0iNjAiIGZpbGw9InJnYigxMTAsOTIsMTkwKSIvPjx0ZXh0IHg9IjE1MCIgeT0iMzMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNiIgZmlsbD0icmdiKDIzNSwyMzUsMjQ1KSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UG9zdGVyPC90ZXh0Pjwvc3ZnPg==';

const FALLBACK =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0icmdiKDQwLDM2LDU0KSIvPjx0ZXh0IHg9IjE1MCIgeT0iMjMwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0icmdiKDE1MCwxNDYsMTcwKSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+ZmFsbGJhY2s8L3RleHQ+PC9zdmc+';

/** Not decodable as an image, so it fails immediately instead of timing out. */
const BROKEN = 'data:image/png;base64,QUJD';

const meta = {
  title: 'Primitives/SafeImage',
  component: SafeImage,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '200px' },
    }),
  ],
  args: {
    className: 'block w-full aspect-[2/3]',
    // Short, because every story here resolves without a network round trip.
    perTryTimeoutMs: 500,
  },
} satisfies Meta<typeof SafeImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first candidate loads, which is the whole of the happy path. */
export const Loaded: Story = {
  args: {
    sources: [POSTER],
    alt: 'Poster artwork',
  },
};

/** The preferred source fails and the next one wins -- not an error, just a fallback rank. */
export const SecondSourceWins: Story = {
  args: {
    sources: [BROKEN, POSTER],
    alt: 'Poster artwork',
  },
};

/** Every candidate fails, so `fallbackSrc` is loaded instead. */
export const AllSourcesFailed: Story = {
  args: {
    sources: [BROKEN, BROKEN],
    fallbackSrc: FALLBACK,
    alt: 'Poster artwork',
  },
};

/**
 * Every candidate fails and `placeholderTitle` is set: a titled panel on the
 * card's own ground, rather than a bright not-found illustration.
 */
export const PlaceholderPanel: Story = {
  args: {
    sources: [BROKEN],
    placeholderTitle: 'Bocchi the Rock!',
  },
};

/** A long title in the placeholder panel, which is where the text has to hold up. */
export const PlaceholderLongTitle: Story = {
  args: {
    sources: [BROKEN],
    placeholderTitle: 'That Time I Got Reincarnated as a Slime the Movie: Scarlet Bond',
  },
};

/** Above the fold: eager loading and high fetch priority instead of lazy. */
export const Priority: Story = {
  args: {
    sources: [POSTER],
    alt: 'Poster artwork',
    priority: true,
  },
};
