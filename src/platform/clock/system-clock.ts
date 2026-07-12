import type { Clock } from '../../shared-kernel/clock.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
