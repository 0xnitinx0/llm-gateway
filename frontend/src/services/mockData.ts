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
  totalRequests: 1248,
  cacheHitRate: 67.4,
  tokensSaved: 42180,
  estimatedSavings: 12.84,
  averageLatencySec: 1.24,
};

export const MOCK_REQUEST_OVERVIEW: RequestDataPoint[] = [
  { day: 'Monday', requests: 180 },
  { day: 'Tuesday', requests: 220 },
  { day: 'Wednesday', requests: 195 },
  { day: 'Thursday', requests: 260 },
  { day: 'Friday', requests: 280 },
  { day: 'Saturday', requests: 310 },
  { day: 'Sunday', requests: 295 },
];

export const MOCK_CACHE_BREAKDOWN: CacheBreakdown = {
  hits: 842,
  misses: 406,
  hitRate: 67.4,
};

export const MOCK_RECENT_ACTIVITY: ActivityLogItem[] = [
  { id: 'REQ-A81F', time: '10:42 AM', result: 'HIT', similarity: 0.94, latency: '120ms' },
  { id: 'REQ-A820', time: '10:41 AM', result: 'HIT', similarity: 0.88, latency: '135ms' },
  { id: 'REQ-A821', time: '10:40 AM', result: 'MISS', similarity: null, latency: '1.84s' },
  { id: 'REQ-A822', time: '10:38 AM', result: 'HIT', similarity: 0.91, latency: '110ms' },
  { id: 'REQ-A823', time: '10:35 AM', result: 'HIT', similarity: 0.95, latency: '115ms' },
  { id: 'REQ-A824', time: '10:31 AM', result: 'MISS', similarity: null, latency: '1.62s' },
];

export const MOCK_USAGE_METRICS: UsageMetrics = {
  totalRequests: 1248,
  llmCalls: 812,
  cacheHits: 436,
  tokensSaved: 42180,
  estimatedCostSaved: 12.84,
  withoutGatewayTokens: 60240,
  withGatewayTokens: 42180,
  compressionRatio: 70,
  costWithoutGateway: 38.40,
  costWithGateway: 25.56,
};

export const MOCK_SIMILARITY_DISTRIBUTION: SimilarityBucket[] = [
  { range: '0.90–1.00', count: 320 },
  { range: '0.80–0.90', count: 210 },
  { range: '0.75–0.80', count: 90 },
  { range: '<0.75', count: 40 },
];

export const MOCK_CACHE_ACTIVITY: CacheEntryActivity[] = [
  { id: 'ENTRY-8A21', time: '10:42', similarity: 0.94, result: 'HIT', latency: '120ms' },
  { id: 'ENTRY-8A22', time: '10:41', similarity: 0.88, result: 'HIT', latency: '135ms' },
  { id: 'ENTRY-8A23', time: '10:40', similarity: 0.62, result: 'MISS', latency: '1.84s' },
  { id: 'ENTRY-8A24', time: '10:38', similarity: 0.91, result: 'HIT', latency: '110ms' },
  { id: 'ENTRY-8A25', time: '10:35', similarity: 0.82, result: 'HIT', latency: '142ms' },
  { id: 'ENTRY-8A26', time: '10:30', similarity: 0.58, result: 'MISS', latency: '1.75s' },
];

export const MOCK_COMPRESSION_METRICS: CompressionMetrics = {
  originalTokens: 420,
  compressedTokens: 294,
  tokensSaved: 126,
  compressionRatio: 70,
};

export const MOCK_TOURNAMENT_METRICS: TournamentMetrics = {
  tournamentsCount: 124,
  averageCandidates: 3,
  averageJudgeScore: 0.87,
  bestResponseRate: 82,
};

export const INITIAL_MOCK_API_KEYS: ApiKeyItem[] = [
  {
    id: 'key-1',
    name: 'Production Key',
    maskedKey: 'gw_live_8f93••••••••••••49b1',
    createdAt: 'Sep 11, 2026',
    lastUsed: 'Just now',
    status: 'active',
  },
  {
    id: 'key-2',
    name: 'Development & Testing',
    maskedKey: 'gw_test_3108••••••••••••21c4',
    createdAt: 'Sep 08, 2026',
    lastUsed: '2 hours ago',
    status: 'active',
  },
];
