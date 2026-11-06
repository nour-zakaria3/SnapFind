import { describe, expect, it } from 'vitest';
import { InvalidImageError, fitWithin, validateImageFile } from '../src/imaging/resize';

describe('resize', () => {
  it('scales landscape to 1600 wide', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales portrait by the long side', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('leaves small images unchanged', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('rejects a non-image file with InvalidImageError', () => {
    const f = new File(['hello'], 'notes.jpg', { type: 'text/plain' });
    expect(() => validateImageFile(f)).toThrow(InvalidImageError);
  });

  it('rejects files over 30MB', () => {
    const big = new File([new Uint8Array(31 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    expect(() => validateImageFile(big)).toThrow(InvalidImageError);
  });

  it('accepts a normal jpeg', () => {
    const ok = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' });
    expect(() => validateImageFile(ok)).not.toThrow();
  });
});
