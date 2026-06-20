import { randomUUID } from 'node:crypto';
import type { TokenGenerator } from '../../domain/token-generator.js';

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomUUID();
  }
}
