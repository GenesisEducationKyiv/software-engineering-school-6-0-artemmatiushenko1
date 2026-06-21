import type {
  Subscription,
  ConfirmationTokenScope,
  Email,
  RepoPath,
} from '../../domain/index.js';
import type { DomainTransaction } from '../../../../domain/shared/transaction-manager.js';

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
