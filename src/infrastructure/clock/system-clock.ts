import type { Clock } from '../../domain/shared/index.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
