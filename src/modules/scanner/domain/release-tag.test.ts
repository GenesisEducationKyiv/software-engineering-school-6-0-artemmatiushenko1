import { describe, it, expect } from 'vitest';
import { ReleaseTag } from './release-tag.js';
import { InvalidReleaseTagError } from './errors.js';

describe('ReleaseTag', () => {
  describe('fromString', () => {
    it('should create a ReleaseTag for a non-empty value', () => {
      const tag = ReleaseTag.fromString('v1.26.0');

      expect(tag.value).toBe('v1.26.0');
    });

    it.each(['v1.0.0', 'v18.2.0', '1.0.0', 'release-candidate'])(
      'should accept valid release tag: %s',
      (value) => {
        const tag = ReleaseTag.fromString(value);

        expect(tag.value).toBe(value);
      },
    );

    it('should throw InvalidReleaseTagError for an empty tag', () => {
      expect(() => ReleaseTag.fromString('')).toThrow(InvalidReleaseTagError);
      expect(() => ReleaseTag.fromString('')).toThrow('Invalid release tag: ');
    });
  });

  describe('equals', () => {
    it('should return true for tags with the same value', () => {
      const first = ReleaseTag.fromString('v1.26.0');
      const second = ReleaseTag.fromString('v1.26.0');

      expect(first.equals(second)).toBe(true);
    });

    it('should return false for tags with different values', () => {
      const first = ReleaseTag.fromString('v1.26.0');
      const second = ReleaseTag.fromString('v1.27.0');

      expect(first.equals(second)).toBe(false);
    });
  });
});
