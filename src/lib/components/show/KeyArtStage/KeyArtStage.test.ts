import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import KeyArtStage from './KeyArtStage.svelte';
import { bannerSourcesFor } from './KeyArtStage.logic';
import { stubNeverLoadingImages } from '$lib/components/__tests__/jsdom-gaps';

/**
 * The reusable key-art stage: artwork as the ground, scrims over it, and
 * whatever the call site slots on top.
 *
 * Which URLs the artwork is tried in is `bannerSourcesFor` and is covered by
 * `KeyArtStage.logic.test.ts`. What is left here is the shell: that the
 * children always render (with or without artwork), that the artwork layer is
 * absent rather than empty when there is no id, and that the picture is
 * decorative rather than announced.
 *
 * Almost everything else about this component is appearance -- three gradient
 * scrims and a fade band -- and jsdom loads no stylesheets, so the scrims are
 * asserted only as *present and hidden from assistive tech*. Whether they
 * actually make the title legible over the art is a Playwright/visual question.
 */

let restoreImages: () => void;
beforeEach(() => {
  restoreImages = stubNeverLoadingImages();
});
afterEach(() => restoreImages());

const stageContent = (text: string) =>
  createRawSnippet(() => ({ render: () => `<h1>${text}</h1>` }));

describe('KeyArtStage', () => {
  describe('what sits on the stage', () => {
    it('renders its children over the artwork', () => {
      render(KeyArtStage, {
        props: { imageId: 'abc123', children: stageContent('Winter 2024') }
      });

      expect(screen.getByRole('heading', { name: 'Winter 2024' })).toBeInTheDocument();
    });

    it('still renders its children when the record has no artwork at all', () => {
      // The stage is a shell: a page with no banner still needs its heading.
      render(KeyArtStage, { props: { imageId: null, children: stageContent('Winter 2024') } });

      expect(screen.getByRole('heading', { name: 'Winter 2024' })).toBeInTheDocument();
    });

    it('renders as an empty stage when nothing is slotted into it', () => {
      const { container } = render(KeyArtStage, { props: { imageId: 'abc123' } });

      expect(container.querySelector('.key-art__stage')).toBeInTheDocument();
      expect(container.querySelector('.key-art__stage')?.textContent?.trim()).toBe('');
    });
  });

  describe('the artwork layer', () => {
    it('is absent entirely when there is no id to build a candidate from', () => {
      const { container } = render(KeyArtStage, { props: { imageId: null } });

      // Absent, not an empty box: `bannerSourcesFor(null)` is `[]`, and an
      // empty SafeImage would draw its own placeholder over the stage.
      expect(bannerSourcesFor(null)).toEqual([]);
      expect(container.querySelector('.key-art__bg')).toBeNull();
    });

    it('is drawn once there is an id', () => {
      const { container } = render(KeyArtStage, { props: { imageId: 'abc123' } });

      expect(container.querySelector('.key-art__bg')).toBeInTheDocument();
    });

    it('is decorative -- the artwork is never announced as content', () => {
      render(KeyArtStage, { props: { imageId: 'abc123', children: stageContent('Title') } });

      // An empty alt on the banner: the heading on the stage names the page,
      // and a second announcement of the same show is noise.
      expect(screen.queryByRole('img', { name: /.+/ })).not.toBeInTheDocument();
    });
  });

  describe('the scrims', () => {
    it('draws all three, none of them announced', () => {
      const { container } = render(KeyArtStage, { props: { imageId: 'abc123' } });

      // These are gradients over the art. jsdom applies no CSS, so the only
      // honest assertion is that the elements exist and carry no content --
      // whether they darken the lower half enough to hold white type is a
      // visual fact and belongs to the Playwright layer.
      for (const scrim of ['top', 'text', 'bottom']) {
        const el = container.querySelector(`.key-art__scrim-${scrim}`);
        expect(el).toBeInTheDocument();
        expect(el?.textContent).toBe('');
      }
    });
  });

  describe('the stage height', () => {
    it('defaults to the full viewport plus the fade band', () => {
      const { container } = render(KeyArtStage, { props: { imageId: 'abc123' } });

      // The inline `min-height` IS the contract -- it is the one thing the
      // prop controls, and the fade band has to be added to whatever the
      // caller asked for or the dissolve eats into the content.
      expect(container.querySelector('.key-art')).toHaveAttribute(
        'style',
        'min-height: calc(100svh + var(--art-fade));'
      );
    });

    it('takes a shorter stage for a page whose subject is a list, not the art', () => {
      const { container } = render(KeyArtStage, {
        props: { imageId: 'abc123', minHeight: '420px' }
      });

      expect(container.querySelector('.key-art')).toHaveAttribute(
        'style',
        'min-height: calc(420px + var(--art-fade));'
      );
    });
  });
});
