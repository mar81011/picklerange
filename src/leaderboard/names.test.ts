import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, sanitizeName } from './names';

describe('sanitizeName', () => {
  it('uppercases and keeps letters, digits and spaces', () => {
    expect(sanitizeName('Joseph')).toBe('JOSEPH');
    expect(sanitizeName('dj 2k!')).toBe('DJ 2K');
  });

  it('collapses and trims whitespace', () => {
    expect(sanitizeName('  ana   maria ')).toBe('ANA MARIA');
  });

  it('caps the length without leaving a trailing space', () => {
    expect(sanitizeName('a'.repeat(30))).toHaveLength(MAX_NAME_LENGTH);
    expect(sanitizeName('ABCDEFGHI JKL')).toBe('ABCDEFGHI');
  });

  it('turns accented letters into plain ones and drops emoji', () => {
    expect(sanitizeName('Zoë 🏓')).toBe('ZOE');
    expect(sanitizeName('Peña')).toBe('PENA');
  });

  it('returns null when nothing usable remains', () => {
    expect(sanitizeName('')).toBeNull();
    expect(sanitizeName('   ')).toBeNull();
    expect(sanitizeName('!!!')).toBeNull();
  });
});
