import { createRawSnippet } from 'svelte';
import type { Meta, StoryObj } from '@storybook/svelte';
import Modal from '$lib/components/primitives/Modal.svelte';

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
      <button type="button" style="align-self: flex-start; min-height: 44px; padding: 7px 18px; border: none; border-radius: var(--weeb-radius); background: var(--weeb-accent); color: white; font-size: 14px; font-weight: 600; cursor: pointer;">
        Continue
      </button>
    </div>
  `,
}));

/** Wide content, so a size story shows the size rather than a narrow column in it. */
const wideBody = createRawSnippet(() => ({
  render: () => `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--weeb-fg);">
        Crop your picture
      </h2>
      <div style="height: 220px; border-radius: var(--weeb-radius); background: repeating-linear-gradient(45deg, var(--weeb-surface), var(--weeb-surface) 12px, var(--weeb-surface-hover) 12px, var(--weeb-surface-hover) 24px);"></div>
      <p style="margin: 0; font-size: 13px; color: var(--weeb-fg-secondary);">
        The card's max-width is the only thing that changes between these three.
      </p>
    </div>
  `,
}));

const meta = {
  title: 'Primitives/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
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

/** 440px, the default: a form you fill in and dismiss. */
export const SizeSmall: Story = {
  args: {
    isOpen: true,
    size: 'sm',
    children: wideBody,
  },
};

/** 560px: a list, or a form with two columns. */
export const SizeMedium: Story = {
  args: {
    isOpen: true,
    size: 'md',
    children: wideBody,
  },
};

/**
 * 720px: something you work inside, like the image cropper. Before `size`
 * existed the cropper passed `className="max-w-2xl"` and still measured 440px,
 * because the card declares its own max-width at the same specificity.
 */
export const SizeLarge: Story = {
  args: {
    isOpen: true,
    size: 'lg',
    children: wideBody,
  },
};
