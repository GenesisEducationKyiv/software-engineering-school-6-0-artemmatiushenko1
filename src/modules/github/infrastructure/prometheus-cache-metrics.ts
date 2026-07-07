import { Counter } from 'prom-client';
import type { CacheMetrics } from '../api/cache-metrics.interface.js';

export class PrometheusCacheMetrics implements CacheMetrics {
  private readonly cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['type'],
  });

  private readonly cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['type'],
  });

  incrementCacheHit(type: string): void {
    this.cacheHits.inc({ type });
  }

  incrementCacheMiss(type: string): void {
    this.cacheMisses.inc({ type });
  }
}
