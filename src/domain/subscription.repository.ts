import type { Subscription } from './subscription/subscription.js';
import type { Email } from './subscription/email.js';
import type { RepoPath } from './subscription/repo-path.js';
import type { SubscriptionTokenScope } from './subscription.js';
import type { DomainTransaction } from './transaction-manager.js';

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;

  findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null>;

  findByToken(
    tokenValue: string,
    scope: SubscriptionTokenScope,
  ): Promise<Subscription | null>;

  save(subscription: Subscription, tx?: DomainTransaction): Promise<void>;

  findConfirmedSubscriptionsByEmail(email: Email): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;
}
