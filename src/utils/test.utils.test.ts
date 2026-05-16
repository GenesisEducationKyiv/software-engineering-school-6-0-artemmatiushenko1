import { describe, it, expect } from 'vitest';
import z from 'zod';
import { parseResponse } from './test.utils.js';

describe('test.utils', () => {
  describe('parseResponse', () => {
    it('should parse valid JSON and validate against schema', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });
      const response = JSON.stringify({ id: 1, name: 'test' });

      const result = parseResponse(response, schema);

      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should throw error for invalid JSON', () => {
      const schema = z.object({ id: z.number() });
      const response = 'invalid json';

      expect(() => parseResponse(response, schema)).toThrow();
    });

    it('should throw error for schema mismatch', () => {
      const schema = z.object({ id: z.number() });
      const response = JSON.stringify({ id: 'not a number' });

      expect(() => parseResponse(response, schema)).toThrow();
    });
  });
});
