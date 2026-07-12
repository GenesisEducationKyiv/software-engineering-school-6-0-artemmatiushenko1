export interface CacheMetrics {
  incrementCacheHit(type: string): void;
  incrementCacheMiss(type: string): void;
}
