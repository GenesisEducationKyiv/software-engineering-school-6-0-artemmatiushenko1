import { Counter, type Registry } from 'prom-client';
import type { CacheMetrics } from '../api/cache-metrics.interface.js';

export class PrometheusCacheMetrics implements CacheMetrics {
  private readonly cacheHits: Counter;
  private readonly cacheMisses: Counter;

  constructor(registry: Registry) {
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['type'],
      registers: [registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['type'],
      registers: [registry],
    });
  }

  incrementCacheHit(type: string): void {
    this.cacheHits.inc({ type });
  }

  incrementCacheMiss(type: string): void {
    this.cacheMisses.inc({ type });
  }
}
