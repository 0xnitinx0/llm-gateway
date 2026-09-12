import { apiRequest } from './api';
import {
  SimilarityBucket,
  CacheEntryActivity,
  CacheBreakdown,
} from '../types/gateway';

interface DebugCacheResponse {
  total_entries: number;
  entries: Array<{
    entry_id: string;
    embedding_dim: number;
    response_preview: string;
    created_at?: string;
  }>;
}

interface RealUsageResponse {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;
  similarity_distribution?: SimilarityBucket[];
  recent_activity?: Array<{
    id: string;
    time: string;
    result: 'HIT' | 'MISS';
    similarity: number;
    latency: string;
  }>;
}

export async function getCacheSummary(): Promise<CacheBreakdown> {
  try {
    const data = await apiRequest<RealUsageResponse>('/usage');
    if (data) {
      return {
        hits: data.cache_hits,
        misses: data.cache_misses,
        hitRate: data.cache_hit_rate,
      };
    }
  } catch {
    // Return empty state
  }
  return { hits: 0, misses: 0, hitRate: 0 };
}

export async function getSimilarityDistribution(): Promise<SimilarityBucket[]> {
  try {
    const data = await apiRequest<RealUsageResponse>('/usage');
    if (data && data.similarity_distribution) {
      return data.similarity_distribution;
    }
  } catch {
    // Return empty state
  }
  return [];
}

export async function getCacheActivity(): Promise<CacheEntryActivity[]> {
  try {
    const usageData = await apiRequest<RealUsageResponse>('/usage');
    if (usageData && usageData.recent_activity) {
      return usageData.recent_activity.map((item) => ({
        id: item.id,
        time: item.time,
        similarity: item.similarity,
        result: item.result,
        latency: item.latency,
      }));
    }

    const data = await apiRequest<DebugCacheResponse>('/debug/cache');
    if (data && data.entries) {
      return data.entries.map((entry) => ({
        id: entry.entry_id,
        time: entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : 'N/A',
        similarity: 1.0,
        result: 'HIT',
        latency: 'Cached',
      }));
    }
  } catch {
    // Return empty array
  }
  return [];
}
