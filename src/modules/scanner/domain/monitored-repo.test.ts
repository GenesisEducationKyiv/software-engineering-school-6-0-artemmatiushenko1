import { describe, it, expect } from 'vitest';
import { Email, RepoPath, ReleaseTag } from './index.js';
import { EmptyMonitoredRepoError, RepoWatcherNotFoundError } from './errors.js';
import { MonitoredRepo } from './monitored-repo.js';
import { RepoWatcher } from './repo-watcher.js';

function repoPath(value: string): RepoPath {
  return RepoPath.fromString(value);
}

function tag(value: string): ReleaseTag {
  return ReleaseTag.fromString(value);
}

function email(value: string): Email {
  return Email.fromString(value);
}

function watcher(
  subscriptionId: string,
  lastNotifiedTag: string | null,
  emailAddress = `${subscriptionId}@example.com`,
) {
  return RepoWatcher.create({
    subscriptionId,
    email: email(emailAddress),
    unsubscribeToken: `unsub-${subscriptionId}`,
    lastNotifiedTag: lastNotifiedTag ? tag(lastNotifiedTag) : null,
  });
}

describe('RepoWatcher', () => {
  it('notifies when latest tag differs from last notified', () => {
    const alice = watcher('alice', 'v1.22');

    expect(alice.shouldNotifyFor(tag('v1.26'))).toBe(true);
    expect(alice.shouldNotifyFor(tag('v1.22'))).toBe(false);
  });

  it('notifies when last notified is null', () => {
    const bob = watcher('bob', null);

    expect(bob.shouldNotifyFor(tag('v1.0.0'))).toBe(true);
  });

  it('updates last notified after markNotified', () => {
    const alice = watcher('alice', 'v1.22');

    alice.markNotified(tag('v1.26'));

    expect(alice.lastNotifiedTag?.value).toBe('v1.26');
    expect(alice.shouldNotifyFor(tag('v1.26'))).toBe(false);
    expect(alice.shouldNotifyFor(tag('v1.27'))).toBe(true);
  });
});

describe('MonitoredRepo', () => {
  it('detects a new release from the repo cursor', () => {
    const repo = MonitoredRepo.rehydrate({
      repo: repoPath('golang/go'),
      lastSeenTag: tag('v1.22'),
      watchers: [watcher('alice', 'v1.22')],
    });

    expect(repo.hasNewRelease(tag('v1.23'))).toBe(true);
    expect(repo.hasNewRelease(tag('v1.22'))).toBe(false);
  });

  it('rejects rehydrate without watchers', () => {
    expect(() =>
      MonitoredRepo.rehydrate({
        repo: repoPath('golang/go'),
        lastSeenTag: null,
        watchers: [],
      }),
    ).toThrow(EmptyMonitoredRepoError);
  });

  it('treats any tag as new when lastSeenTag is null', () => {
    const repo = MonitoredRepo.create(repoPath('golang/go'));

    expect(repo.hasNewRelease(tag('v1.0.0'))).toBe(true);
  });

  it('returns watchers eligible for a release', () => {
    const repo = MonitoredRepo.rehydrate({
      repo: repoPath('golang/go'),
      lastSeenTag: tag('v1.25'),
      watchers: [watcher('alice', 'v1.22'), watcher('bob', 'v1.26')],
    });

    const eligible = repo.eligibleWatchers(tag('v1.26'));

    expect(eligible.map((w) => w.subscriptionId)).toEqual(['alice']);
  });

  it('replaces an existing watcher on add', () => {
    const repo = MonitoredRepo.create(repoPath('golang/go'));

    repo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-1',
        email: email('old@example.com'),
        unsubscribeToken: 'token-1',
        lastNotifiedTag: tag('v1.0.0'),
      }),
    );
    repo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-1',
        email: email('new@example.com'),
        unsubscribeToken: 'token-2',
        lastNotifiedTag: tag('v2.0.0'),
      }),
    );

    expect(repo.watchers).toHaveLength(1);
    expect(repo.watchers[0]?.email.value).toBe('new@example.com');
    expect(repo.watchers[0]?.lastNotifiedTag?.value).toBe('v2.0.0');
  });

  it('removes a watcher and reports when none remain', () => {
    const alice = watcher('alice', 'v1.0.0');
    const repo = MonitoredRepo.rehydrate({
      repo: repoPath('golang/go'),
      lastSeenTag: null,
      watchers: [alice],
    });

    expect(repo.removeWatcher(alice)).toBe(true);
    expect(repo.watchers).toHaveLength(0);
  });

  it('updates the repo release cursor', () => {
    const repo = MonitoredRepo.create(repoPath('golang/go'));

    repo.markReleaseSeen(tag('v1.26'));

    expect(repo.lastSeenTag?.value).toBe('v1.26');
    expect(repo.hasNewRelease(tag('v1.26'))).toBe(false);
  });

  it('updates watcher last notified tag', () => {
    const repo = MonitoredRepo.rehydrate({
      repo: repoPath('golang/go'),
      lastSeenTag: null,
      watchers: [watcher('alice', 'v1.22')],
    });

    repo.markWatcherNotified('alice', tag('v1.26'));

    expect(repo.watchers[0]?.lastNotifiedTag?.value).toBe('v1.26');
    expect(repo.watchers[0]?.shouldNotifyFor(tag('v1.26'))).toBe(false);
  });

  it('throws when marking notification for unknown watcher', () => {
    const repo = MonitoredRepo.rehydrate({
      repo: repoPath('golang/go'),
      lastSeenTag: null,
      watchers: [watcher('alice', 'v1.22')],
    });

    expect(() => repo.markWatcherNotified('bob', tag('v1.26'))).toThrow(
      RepoWatcherNotFoundError,
    );
  });
});
