import { describe, it, expect } from 'vitest';
import { darkenHexColor } from './colorUtils';

describe('darkenHexColor', () => {
  it('darkens white by 20', () => {
    expect(darkenHexColor('#ffffff', 20)).toBe('rgb(235, 235, 235)');
  });

  it('darkens a sky-blue color by 20', () => {
    // #0ea5e9 = r:14, g:165, b:233
    expect(darkenHexColor('#0ea5e9', 20)).toBe('rgb(0, 145, 213)');
  });

  it('clamps channel below 0 to 0', () => {
    expect(darkenHexColor('#101010', 20)).toBe('rgb(0, 0, 0)');
  });

  it('handles pure black without going negative', () => {
    expect(darkenHexColor('#000000', 20)).toBe('rgb(0, 0, 0)');
  });

  it('zero amount returns original color', () => {
    expect(darkenHexColor('#abcdef', 0)).toBe('rgb(171, 205, 239)');
  });
});
