import { describe, it, expect } from 'vitest';
import { hasScore, scoreText } from './Score.logic';

describe('scoreText', () => {
  it('draws a number to one decimal place, always', () => {
    // 8 and 8.0 are the same rating and must not be two widths in a column.
    expect(scoreText(8)).toBe('8.0');
    expect(scoreText(8.94)).toBe('8.9');
    expect(scoreText(10)).toBe('10.0');
    expect(scoreText(0)).toBe('0.0');
  });

  it('passes an already-formatted score through -- the API sends both', () => {
    expect(scoreText('8.94')).toBe('8.94');
    expect(scoreText('N/A')).toBe('N/A');
  });

  it('draws nothing for an absent score', () => {
    expect(scoreText(null)).toBe('');
    expect(scoreText(undefined)).toBe('');
    expect(scoreText('')).toBe('');
  });
});

describe('hasScore', () => {
  it('counts any number, zero included', () => {
    expect(hasScore(8)).toBe(true);
    expect(hasScore(0)).toBe(true);
  });

  it('counts a non-empty string', () => {
    expect(hasScore('8.94')).toBe(true);
  });

  it('treats empty string as absent -- an unrated show sends one', () => {
    expect(hasScore('')).toBe(false);
    expect(hasScore(null)).toBe(false);
    expect(hasScore(undefined)).toBe(false);
  });
});
