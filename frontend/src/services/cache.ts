import {
  SimilarityBucket,
  CacheEntryActivity,
  CacheBreakdown,
} from '../types/gateway';
import {
  MOCK_CACHE_BREAKDOWN,
  MOCK_SIMILARITY_DISTRIBUTION,
  MOCK_CACHE_ACTIVITY,
} from './mockData';

export async function getCacheSummary(): Promise<CacheBreakdown> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_CACHE_BREAKDOWN;
}

export async function getSimilarityDistribution(): Promise<SimilarityBucket[]> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_SIMILARITY_DISTRIBUTION;
}

export async function getCacheActivity(): Promise<CacheEntryActivity[]> {
  await new Promise((r) => setTimeout(r, 60));
  return MOCK_CACHE_ACTIVITY;
}
