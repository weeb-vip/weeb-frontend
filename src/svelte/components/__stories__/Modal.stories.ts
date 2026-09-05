import { createRawSnippet } from 'svelte';
import type { Meta, StoryObj } from '@storybook/svelte';
import Modal from '../Modal.svelte';

/**
 * Modal portals itself to <body>, so its content comes in as a snippet rather
 * than as props. A raw snippet is the story-args equivalent of slot content.
 */
const dialogBody = createRawSnippet(() => ({
  render: () => `
    <div style="display: flex; flex-direction: column; gap: 12px; min-width: 280px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--weeb-fg);">
        Sign in to weeb.vip
      </h2>
      <p style="margin: 0; font-size: 14px; color: var(--weeb-fg-secondary);">
        Track what you are watching and pick up where you left off.
      </p>
      <button type="button" style="align-self: flex-start; min-height: 44px; padding: 7px 18px; border: none; border-radius: var(--weeb-radius, 8px); background: var(--weeb-accent); color: white; font-size: 14px; font-weight: 600; cursor: pointer;">
        Continue
      </button>
    </div>
  `,
}));

const meta = {
  title: 'Design System/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open: backdrop, focus trap, and the corner close button. */
export const Open: Story = {
  args: {
    isOpen: true,
    children: dialogBody,
  },
};

/** No close button -- for a dialog the caller dismisses itself, e.g. after a save. */
export const WithoutCloseButton: Story = {
  args: {
    isOpen: true,
    showCloseButton: false,
    children: dialogBody,
  },
};

/** Backdrop clicks are ignored, so a half-finished form cannot be lost by a stray click. */
export const BackdropLocked: Story = {
  args: {
    isOpen: true,
    backdropCloseable: false,
    children: dialogBody,
  },
};

/** Closed: nothing is rendered at all, and body scrolling is handed back. */
export const Closed: Story = {
  args: {
    isOpen: false,
    children: dialogBody,
  },
};
