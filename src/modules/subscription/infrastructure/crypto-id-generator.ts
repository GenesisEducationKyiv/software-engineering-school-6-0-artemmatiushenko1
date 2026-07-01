import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../../shared-kernel/index.js';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
