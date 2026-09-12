import { apiRequest } from './api';
import {
  DashboardMetrics,
  RequestDataPoint,
  CacheBreakdown,
  ActivityLogItem,
  UsageMetrics,
  CompressionMetrics,
  TournamentMetrics,
  BackendUsageResponse,
} from '../types/gateway';

async function fetchRealUsage(): Promise<BackendUsageResponse | null> {
  try {
    return await apiRequest<BackendUsageResponse>('/usage');
  } catch {
    return null;
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const real = await fetchRealUsage();
  if (real) {
    return {
      totalRequests: real.total_requests,
      cacheHitRate: real.cache_hit_rate,
      tokensSaved: null,
      estimatedSavings: real.estimated_savings,
      averageLatencySec:
        real.avg_latency_ms !== null
          ? Math.round((real.avg_latency_ms / 1000) * 100) / 100
          : null,
    };
  }
  return {
    totalRequests: 0,
    cacheHitRate: 0,
    tokensSaved: null,
    estimatedSavings: null,
    averageLatencySec: null,
  };
}

export async function getRequestOverviewData(): Promise<RequestDataPoint[]> {
  const real = await fetchRealUsage();
  if (real && real.history) {
    return real.history;
  }
  return [];
}

export async function getCacheBreakdown(): Promise<CacheBreakdown> {
  const real = await fetchRealUsage();
  if (real) {
    return {
      hits: real.cache_hits,
      misses: real.cache_misses,
      hitRate: real.cache_hit_rate,
    };
  }
  return { hits: 0, misses: 0, hitRate: 0 };
}

export async function getRecentActivity(): Promise<ActivityLogItem[]> {
  const real = await fetchRealUsage();
  if (real && real.recent_activity) {
    return real.recent_activity;
  }
  return [];
}

export async function getUsageMetrics(): Promise<UsageMetrics> {
  const real = await fetchRealUsage();
  if (real) {
    return {
      totalRequests: real.total_requests,
      llmCalls: real.llm_calls,
      cacheHits: real.cache_hits,
      tokensSaved: null,
      estimatedCostSaved: real.estimated_cost_saved ?? real.estimated_savings,
      actualProviderCost: real.actual_provider_cost ?? real.estimated_cost,
      estimatedCostWithoutGateway: real.estimated_cost_without_gateway,
      totalInputTokens: real.total_input_tokens,
      totalOutputTokens: real.total_output_tokens,
      totalTokens: real.total_tokens,
      estimatedCost: real.actual_provider_cost ?? real.estimated_cost,
    };
  }
  return {
    totalRequests: 0,
    llmCalls: 0,
    cacheHits: 0,
    tokensSaved: null,
    estimatedCostSaved: 0,
    actualProviderCost: 0,
    estimatedCostWithoutGateway: 0,
    totalInputTokens: null,
    totalOutputTokens: null,
    totalTokens: null,
    estimatedCost: 0,
  };
}


export async function getCompressionMetrics(): Promise<CompressionMetrics> {
  return {
    originalTokens: 0,
    compressedTokens: 0,
    tokensSaved: 0,
    compressionRatio: 0,
  };
}

export async function getTournamentMetrics(): Promise<TournamentMetrics> {
  return {
    tournamentsCount: 0,
    averageCandidates: 0,
    averageJudgeScore: 0,
    bestResponseRate: 0,
  };
}
