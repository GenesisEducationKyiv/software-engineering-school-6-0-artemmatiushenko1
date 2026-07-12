import { describe, it, expect } from 'vitest';
import { RepoPath } from '../../../src/shared-kernel/repo-path.js';
import { InvalidRepoFormatError } from '../../../src/shared-kernel/errors.js';

describe('RepoPath', () => {
  describe('fromString', () => {
    it('should create a RepoPath for a valid path', () => {
      const repoPath = RepoPath.fromString('facebook/react');

      expect(repoPath.owner).toBe('facebook');
      expect(repoPath.repo).toBe('react');
    });

    it.each(['owner/repo', 'my-org/my-repo', 'user-name/repo-name'])(
      'should accept valid repo path: %s',
      (path) => {
        const [owner, repo] = path.split('/');
        const repoPath = RepoPath.fromString(path);

        expect(repoPath.owner).toBe(owner);
        expect(repoPath.repo).toBe(repo);
      },
    );

    it('should ignore extra path segments after owner and repo', () => {
      const repoPath = RepoPath.fromString('facebook/react/extra');

      expect(repoPath.owner).toBe('facebook');
      expect(repoPath.repo).toBe('react');
    });

    it('should ignore a trailing slash', () => {
      const repoPath = RepoPath.fromString('facebook/react/');

      expect(repoPath.owner).toBe('facebook');
      expect(repoPath.repo).toBe('react');
    });

    it.each(['invalid-repo', '', 'owner/', '/repo'])(
      'should throw InvalidRepoFormatError for invalid repo path: %s',
      (path) => {
        expect(() => RepoPath.fromString(path)).toThrow(InvalidRepoFormatError);
        expect(() => RepoPath.fromString(path)).toThrow(
          `Invalid repository format: ${path}. Expected 'owner/repo'`,
        );
      },
    );
  });

  describe('toString', () => {
    it('should return owner/repo format', () => {
      const repoPath = RepoPath.fromString('facebook/react');

      expect(repoPath.toString()).toBe('facebook/react');
    });
  });

  it('should be immutable', () => {
    const repoPath = RepoPath.fromString('facebook/react');

    expect(Object.isFrozen(repoPath)).toBe(true);
  });
});
