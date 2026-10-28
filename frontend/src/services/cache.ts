import { getUsageSnapshot, mapActivity, mapCache } from './metrics';
import { CacheBreakdown, CacheEntryActivity, SimilarityBucket } from '../types/gateway';

export async function getCacheSummary(): Promise<CacheBreakdown> { return mapCache(await getUsageSnapshot()); }
export async function getSimilarityDistribution(): Promise<SimilarityBucket[]> { return (await getUsageSnapshot()).similarity_distribution; }
export async function getCacheActivity(): Promise<CacheEntryActivity[]> { return mapActivity(await getUsageSnapshot()); }
