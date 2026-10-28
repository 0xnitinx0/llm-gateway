import { apiRequest } from './api';
import { ActivityLogItem, BackendUsageResponse, CacheBreakdown, CompressionMetrics, DashboardMetrics, RuntimeConfig, TournamentMetrics, UsageMetrics } from '../types/gateway';

export const getUsageSnapshot = (): Promise<BackendUsageResponse> => apiRequest('/usage', { method: 'GET' }, 'admin');
export const getRuntimeConfig = (): Promise<RuntimeConfig> => apiRequest('/v1/admin/config', { method: 'GET' }, 'admin');

export const mapActivity = (data: BackendUsageResponse): ActivityLogItem[] => data.recent_activity.map(item => ({
  id: item.id,
  time: new Date(item.time).toLocaleTimeString(),
  result: item.result,
  similarity: item.similarity,
  latency: item.latency_ms.toFixed(1) + ' ms',
}));

export const mapDashboard = (data: BackendUsageResponse): DashboardMetrics => ({
  totalRequests: data.total_requests,
  cacheHitRate: data.cache_hit_rate,
  tokensSaved: data.compressed_tokens_saved,
  callsAvoided: data.llm_calls_avoided,
  averageLatencySec: data.avg_latency_ms === null ? null : Math.round(data.avg_latency_ms) / 1000,
});

export const mapUsage = (data: BackendUsageResponse): UsageMetrics => ({
  totalRequests: data.total_requests,
  llmCalls: data.llm_calls,
  cacheHits: data.cache_hits,
  callsAvoided: data.llm_calls_avoided,
  rateLimitedRequests: data.rate_limited_requests,
  totalInputTokens: data.total_input_tokens,
  totalOutputTokens: data.total_output_tokens,
  totalTokens: data.total_tokens,
  tokensSaved: data.compressed_tokens_saved,
});

export const mapCompression = (data: BackendUsageResponse): CompressionMetrics => ({
  originalTokens: data.compression.original_tokens,
  compressedTokens: data.compression.compressed_tokens,
  tokensSaved: data.compression.tokens_saved,
  compressionRatio: data.compression.reduction_percent,
});

export const mapTournament = (data: BackendUsageResponse): TournamentMetrics => ({
  tournamentsCount: data.tournaments.count,
  averageCandidates: data.tournaments.average_candidates,
  averageWinningScore: data.tournaments.average_winning_score,
  judgeFallbackRate: data.tournaments.judge_fallback_rate,
});

export const mapCache = (data: BackendUsageResponse): CacheBreakdown => ({
  hits: data.cache_hits,
  misses: data.cache_misses,
  hitRate: data.cache_hit_rate,
  activeEntries: data.active_cache_entries,
});
