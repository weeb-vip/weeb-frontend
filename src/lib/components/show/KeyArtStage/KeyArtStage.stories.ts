import type { Meta, StoryObj } from '@storybook/svelte';
import { createRawSnippet } from 'svelte';
import KeyArtStage from './KeyArtStage.svelte';

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

/**
 * What a hero puts on the stage instead: its own panel, placed by itself. Both
 * heroes take `stage={false}` and hold their content on `.weeb-panel` glass.
 */
const panelContent = createRawSnippet(() => ({
  render: () => `
    <div class="weeb-panel" style="position:relative; z-index:3; margin:0 0 32px 32px; padding:20px; max-width:560px;">
      <h2 style="margin:0 0 12px; font-size:2.2rem; line-height:1.1; color:var(--weeb-fg);">
        Frieren: Beyond Journey’s End
      </h2>
      <p style="margin:0; color:var(--weeb-fg-secondary); font-size:0.9rem;">
        The adventure is over but life goes on for an elf mage just beginning to
        learn what living is all about.
      </p>
    </div>`,
}));

const meta = {
  title: 'Composites/Show/KeyArtStage',
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

/**
 * How the two heroes use it: no padded stage and no text scrim, because they
 * lay their own content out and set it on panel glass rather than straight on
 * the picture. `Composites/Home/HeroBanner` and `Composites/Show/ShowHero` are
 * this stage with their own panel on it.
 */
export const AsAHeroBackdrop: Story = {
  args: {
    imageId: 'storybook-key-art',
    minHeight: '100svh',
    textScrim: false,
    stage: false,
    children: panelContent,
  },
};

/**
 * A caller whose page owns the bleed: no pull up under the nav, nothing
 * clipped, and the fade band read from a variable the page sets. That is the
 * homepage, whose wrapper offsets the banner, the skeleton and the airing rail
 * by the same number.
 */
export const PageOwnsTheBleed: Story = {
  args: {
    imageId: 'storybook-key-art',
    minHeight: '60svh',
    fade: 'var(--hero-fade, 0px)',
    focus: 'center 20%',
    underNav: false,
    clip: false,
    textScrim: false,
    stage: false,
    children: panelContent,
  },
};

/**
 * The load fade, held open. The artwork sits at opacity 0 until the page says
 * something has painted -- only for a page that can guarantee the event, since
 * SafeImage does not dispatch `chosen` on every path.
 */
export const ArtLoading: Story = {
  args: {
    imageId: 'storybook-key-art',
    minHeight: 'clamp(300px, 46svh, 520px)',
    loaded: false,
    children: stageContent,
  },
};
