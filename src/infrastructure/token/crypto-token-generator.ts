import { randomUUID } from 'node:crypto';
import type { TokenGenerator } from '../../domain/shared/index.js';

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomUUID();
  }
}
