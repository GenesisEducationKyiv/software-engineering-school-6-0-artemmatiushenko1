import { describe, it, expect } from 'vitest';
import { parseRepoPath } from './repo.utils.js';

describe('repo.utils', () => {
  describe('parseRepoPath', () => {
    it('should correctly parse owner and repo from a valid path', () => {
      const result = parseRepoPath('facebook/react');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should throw an error if the path is missing the repo part', () => {
      expect(() => parseRepoPath('facebook/')).toThrow(
        'Invalid repository path: facebook/',
      );
      expect(() => parseRepoPath('facebook')).toThrow(
        'Invalid repository path: facebook',
      );
    });

    it('should throw an error if the path is missing the owner part', () => {
      expect(() => parseRepoPath('/react')).toThrow(
        'Invalid repository path: /react',
      );
    });

    it('should throw an error if the path is empty', () => {
      expect(() => parseRepoPath('')).toThrow('Invalid repository path: ');
    });

    it('should handle paths with extra slashes by taking only the first two parts', () => {
      const result = parseRepoPath('facebook/react/extra');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should handle paths with a trailing slash', () => {
      const result = parseRepoPath('facebook/react/');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });
  });
});
