import type {
  Subscription,
  Email,
  RepoPath,
  SubscriptionTokenScope,
} from '../../domain/index.js';
import type { DomainTransaction } from '../../../../shared-kernel/transaction.js';

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;

  findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null>;

  findByToken(
    token: string,
    scope: SubscriptionTokenScope,
  ): Promise<Subscription | null>;

  save(subscription: Subscription, tx?: DomainTransaction): Promise<void>;

  findConfirmedSubscriptionsByEmail(email: Email): Promise<Subscription[]>;
}
