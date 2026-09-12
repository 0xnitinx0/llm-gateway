import {
  DashboardMetrics,
  RequestDataPoint,
  CacheBreakdown,
  ActivityLogItem,
  UsageMetrics,
  SimilarityBucket,
  CacheEntryActivity,
  ApiKeyItem,
  CompressionMetrics,
  TournamentMetrics,
} from '../types/gateway';

export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  totalRequests: 0,
  cacheHitRate: 0,
  tokensSaved: null,
  estimatedSavings: null,
  averageLatencySec: null,
};

export const MOCK_REQUEST_OVERVIEW: RequestDataPoint[] = [];

export const MOCK_CACHE_BREAKDOWN: CacheBreakdown = {
  hits: 0,
  misses: 0,
  hitRate: 0,
};

export const MOCK_RECENT_ACTIVITY: ActivityLogItem[] = [];

export const MOCK_USAGE_METRICS: UsageMetrics = {
  totalRequests: 0,
  llmCalls: 0,
  cacheHits: 0,
  tokensSaved: null,
  estimatedCostSaved: null,
  actualProviderCost: null,
  estimatedCostWithoutGateway: null,
  totalInputTokens: null,
  totalOutputTokens: null,
  totalTokens: null,
  estimatedCost: null,
};


export const MOCK_SIMILARITY_DISTRIBUTION: SimilarityBucket[] = [];

export const MOCK_CACHE_ACTIVITY: CacheEntryActivity[] = [];

export const MOCK_COMPRESSION_METRICS: CompressionMetrics = {
  originalTokens: 0,
  compressedTokens: 0,
  tokensSaved: 0,
  compressionRatio: 0,
};

export const MOCK_TOURNAMENT_METRICS: TournamentMetrics = {
  tournamentsCount: 0,
  averageCandidates: 0,
  averageJudgeScore: 0,
  bestResponseRate: 0,
};

export const INITIAL_MOCK_API_KEYS: ApiKeyItem[] = [];
