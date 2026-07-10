import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../domain/shared/index.js';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
