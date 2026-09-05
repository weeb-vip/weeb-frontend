import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import KeyArtStage from '../KeyArtStage.svelte';

/** The kind of thing a page puts on the stage: a heading and a line of meta. */
const stageContent = createRawSnippet(() => ({
  render: () => `
    <div style="max-width: 720px;">
      <h1 style="margin:0 0 8px; font-size:2.4rem; line-height:1.1; color:var(--weeb-fg);">
        Frieren: Beyond Journey’s End
      </h1>
      <p style="margin:0; color:var(--weeb-fg-secondary); font-size:0.95rem;">
        TV &middot; 28 episodes &middot; Autumn 2023
      </p>
    </div>`,
}));

const meta = {
  title: 'Show/KeyArtStage',
  component: KeyArtStage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof KeyArtStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The short stage a series page uses: artwork behind, scrims over it, content
 * sitting on the bottom edge.
 */
export const WithArtwork: Story = {
  args: {
    imageId: 'storybook-key-art',
    minHeight: 'clamp(300px, 46svh, 520px)',
    children: stageContent,
  },
};

/**
 * No image id at all -- most of the catalogue. The stage keeps its shape and
 * its scrims so the heading lands in the same place either way.
 */
export const WithoutArtwork: Story = {
  args: {
    imageId: null,
    minHeight: '360px',
    children: stageContent,
  },
};

/** The full-viewport treatment, for a page whose subject IS the artwork. */
export const FullViewport: Story = {
  args: {
    imageId: 'storybook-key-art',
    minHeight: '100svh',
    children: stageContent,
  },
};
