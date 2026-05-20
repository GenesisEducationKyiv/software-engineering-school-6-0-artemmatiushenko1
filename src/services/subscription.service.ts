import type { GithubClient } from '../domain/github.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { EmailService } from '../domain/email.js';
import type { Subscription } from '../domain/subscription.js';
import { RepoPathSchema } from '../domain/subscription.js';
import type { SubscriptionTokenManager } from '../domain/subscription-token-manager.js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  TokenNotFoundError,
  InvalidTokenError,
} from '../domain/errors.js';
import { z } from 'zod';
import { parseRepoPath } from '../utils/repo.utils.js';
import type { Logger } from '../domain/logger.js';
import type { TransactionManager } from '../domain/transaction-manager.js';
import { subscriptionConfirmationTemplate } from '../infrastructure/email/templates.js';
import type { Metrics } from '../domain/metrics.js';
import type { ScannerService } from './scanner.service.js';

export class SubscriptionService {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private emailService: EmailService,
    private tokenManager: SubscriptionTokenManager,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private appUrl: string,
    private scannerService?: ScannerService,
    private metrics?: Metrics,
  ) {}

  async subscribe(email: string, repoPath: string): Promise<Subscription> {
    const repoResult = RepoPathSchema.safeParse(repoPath);
    if (!repoResult.success) {
      throw new InvalidRepoFormatError(repoPath);
    }

    const emailResult = z.email().safeParse(email);
    if (!emailResult.success) {
      throw new InvalidEmailError(email);
    }

    const validatedRepo = repoResult.data;
    const validatedEmail = emailResult.data;

    this.metrics?.incrementSubscriptionRequests(validatedRepo);

    const { owner, repo } = parseRepoPath(validatedRepo);

    const exists = await this.githubClient.repositoryExists(owner, repo);
    if (!exists) {
      throw new RepoNotFoundError(validatedRepo);
    }

    const existing = await this.subscriptionRepo.findByEmailAndRepo(
      validatedEmail,
      validatedRepo,
    );
    if (existing) {
      throw new AlreadySubscribedError(validatedEmail, validatedRepo);
    }

    const { subscription, confirmToken } = await this.transactionManager.run(
      async (tx) => {
        const subscription = await this.subscriptionRepo.createSubscription(
          {
            email: validatedEmail,
            repo: validatedRepo,
          },
          tx,
        );

        const confirmToken = await this.tokenManager.createToken(
          subscription.id,
          'subscribe',
          tx,
        );

        await this.tokenManager.createToken(subscription.id, 'unsubscribe', tx);

        return { subscription, confirmToken };
      },
    );

    const confirmUrl = `${this.appUrl}/confirm/${confirmToken}`;
    const template = subscriptionConfirmationTemplate(
      validatedRepo,
      confirmUrl,
    );
    await this.emailService.sendEmail({
      to: validatedEmail,
      ...template,
    });

    this.logger.info(`User ${email} subscribed to ${repoPath}`);

    return subscription;
  }

  async getSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const emailResult = z.email().safeParse(email);
    if (!emailResult.success) {
      throw new InvalidEmailError(email);
    }

    return this.subscriptionRepo.findConfirmedSubscriptionsByEmail(
      emailResult.data,
    );
  }

  async confirmSubscription(tokenValue: string): Promise<void> {
    const token = await this.tokenManager.getTokenByValue(tokenValue);

    if (!token) {
      throw new TokenNotFoundError();
    }

    const isValid = await this.tokenManager.validateToken(token, 'subscribe');
    if (!isValid) {
      throw new InvalidTokenError();
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.confirmSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    const sub = await this.subscriptionRepo.findSubscriptionById(
      token.subscriptionId,
    );
    if (sub) {
      this.metrics?.incrementSubscriptionConfirmations(sub.repo);

      if (this.scannerService) {
        await this.scannerService.scanSubscription(sub.id);
      }
    }

    this.logger.info(`Subscription confirmed for token ${tokenValue}`);
  }

  async unsubscribe(tokenValue: string): Promise<void> {
    const token = await this.tokenManager.getTokenByValue(tokenValue);

    if (!token) {
      throw new TokenNotFoundError();
    }

    const isValid = await this.tokenManager.validateToken(token, 'unsubscribe');
    if (!isValid) {
      throw new InvalidTokenError();
    }

    const sub = await this.subscriptionRepo.findSubscriptionById(
      token.subscriptionId,
    );
    if (sub) {
      this.metrics?.incrementUnsubscribeRequests(sub.repo);
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.deleteSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    this.logger.info(`User unsubscribed via token ${tokenValue}`);
  }
}
