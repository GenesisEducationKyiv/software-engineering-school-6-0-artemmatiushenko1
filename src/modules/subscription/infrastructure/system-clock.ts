import type { Clock } from '../../../platform/clock.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
