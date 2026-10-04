import { describe, it, expect } from 'vitest';
import { DEFAULT_IMAGE_POLICY, SAVE_DATA_POLICY, cappedWidth, imagePolicyFor, imagePolicyFromContext } from './image-policy';

describe('image policy', () => {
  it('is the default unless the visitor asked to save data', () => {
    expect(imagePolicyFor(false)).toBe(DEFAULT_IMAGE_POLICY);
    expect(imagePolicyFor(undefined)).toBe(DEFAULT_IMAGE_POLICY);
    expect(imagePolicyFor(true)).toBe(SAVE_DATA_POLICY);
  });

  it('only ever lowers quality and width for data saver, never for everyone', () => {
    expect(DEFAULT_IMAGE_POLICY).toEqual({ quality: 85, maxWidth: null });
    expect(SAVE_DATA_POLICY.quality).toBeLessThan(DEFAULT_IMAGE_POLICY.quality);
    expect(SAVE_DATA_POLICY.maxWidth).not.toBeNull();
  });

  it('caps a width only under a policy that has a cap', () => {
    expect(cappedWidth(1600, DEFAULT_IMAGE_POLICY)).toBe(1600);
    expect(cappedWidth(1600, SAVE_DATA_POLICY)).toBe(640);
    expect(cappedWidth(360, SAVE_DATA_POLICY)).toBe(360);
  });

  it('is the default outside a component tree', () => {
    expect(imagePolicyFromContext()).toBe(DEFAULT_IMAGE_POLICY);
  });
});
