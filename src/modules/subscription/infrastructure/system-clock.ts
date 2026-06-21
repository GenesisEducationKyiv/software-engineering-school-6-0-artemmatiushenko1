import type { Clock } from '../../../shared-kernel/index.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
