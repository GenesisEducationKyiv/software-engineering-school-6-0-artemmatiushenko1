import type { Subscription } from '../modules/subscription/domain/subscription.js';
import type { Email } from '../modules/subscription/domain/email.js';
import type { RepoPath } from '../modules/subscription/domain/repo-path.js';
import type { DomainTransaction } from './shared/transaction-manager.js';
import type { ConfirmationTokenScope } from '../modules/subscription/domain/confirmation-token.js';

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;

  findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null>;

  findByToken(
    token: string,
    scope: ConfirmationTokenScope,
  ): Promise<Subscription | null>;

  save(subscription: Subscription, tx?: DomainTransaction): Promise<void>;

  findConfirmedSubscriptionsByEmail(email: Email): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;
}
