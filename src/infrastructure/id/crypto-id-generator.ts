import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../domain/id-generator.js';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
