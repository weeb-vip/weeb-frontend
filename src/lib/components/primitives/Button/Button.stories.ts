import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import Button from './Button.svelte';

/** Stories are plain .ts, so a label snippet is built rather than slotted. */
const text = (label: string) => createRawSnippet(() => ({ render: () => `<span>${label}</span>` }));

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['blue', 'red', 'transparent', ''],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'hero', 'icon'],
    },
    status: {
      control: 'select',
      options: ['idle', 'loading', 'success', 'error'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The primary action. */
export const Accent: Story = {
  args: {
    color: 'blue',
    children: text('Add to Watchlist'),
  },
};

/** The quiet, bordered variant for secondary actions. */
export const Ghost: Story = {
  args: {
    color: 'transparent',
    children: text('View Details'),
  },
};

/** Destructive actions, e.g. removing an entry from a list. */
export const Danger: Story = {
  args: {
    color: 'red',
    children: text('Remove from List'),
  },
};

/**
 * In flight. The label stays exactly where it was, at `opacity: 0` under the
 * spinner: replacing it used to collapse the button from 167px to 49px
 * mid-request, and take its accessible name with it.
 */
export const Loading: Story = {
  args: {
    color: 'blue',
    loading: true,
    children: text('Add to Watchlist'),
  },
};

/** The transient confirmation, which falls back to idle on its own after 2s. */
export const Success: Story = {
  args: {
    color: 'blue',
    status: 'success',
    children: text('Add to Watchlist'),
  },
};

/** Unavailable: dimmed, and `onClick` never fires. */
export const Disabled: Story = {
  args: {
    color: 'blue',
    disabled: true,
    children: text('Not Available'),
  },
};

/** A link CTA. Same paint, same focus ring, an `<a>` in the DOM. */
export const Link: Story = {
  args: {
    color: 'blue',
    href: '/auth/login',
    children: text('Go to log in'),
  },
};

/** `sm` is the compact action: EmptyState's CTA and the show page's sticky header. */
export const Small: Story = {
  args: {
    color: 'blue',
    size: 'sm',
    children: text('Show all anime'),
  },
};

/** `lg` + `fullWidth` is the auth submit every auth screen used to hand-roll. */
export const LargeFullWidth: Story = {
  args: {
    color: 'blue',
    size: 'lg',
    fullWidth: true,
    children: text('Create account'),
  },
};

/** `hero` is the pair on the home banner panel: the accent CTA and its ghost sibling. */
export const Hero: Story = {
  args: {
    color: 'blue',
    size: 'hero',
    children: text('View Details'),
  },
};

/** `icon` is the 32px round add button. It needs an `ariaLabel` -- there is no text to read. */
export const IconOnly: Story = {
  args: {
    color: 'blue',
    size: 'icon',
    icon: faPlus,
    ariaLabel: 'Add to list',
  },
};
