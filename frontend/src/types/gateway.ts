// Real backend contract types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GatewayChatRequest {
  messages: ChatMessage[];
}

export interface GatewayChatResponse {
  response: string;
}

export interface HealthResponse {
  status: string;
}

export interface ApiError {
  detail: string;
  status?: number;
}

// Client-side observation of a live execution
export interface LiveRequestResult {
  response: string;
  roundTripLatencyMs: number;
  timestamp: string;
}

// Observability & Mock Metric Types (truthfully labeled as DEMO / PREVIEW)
export interface DashboardMetrics {
  totalRequests: number;
  cacheHitRate: number;
  tokensSaved: number;
  estimatedSavings: number;
  averageLatencySec: number;
}

export interface RequestDataPoint {
  day: string;
  requests: number;
}

export interface CacheBreakdown {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface ActivityLogItem {
  id: string;
  time: string;
  result: 'HIT' | 'MISS';
  similarity: number | null;
  latency: string;
}

export interface UsageMetrics {
  totalRequests: number;
  llmCalls: number;
  cacheHits: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  withoutGatewayTokens: number;
  withGatewayTokens: number;
  compressionRatio: number;
  costWithoutGateway: number;
  costWithGateway: number;
}

export interface SimilarityBucket {
  range: string;
  count: number;
}

export interface CacheEntryActivity {
  id: string;
  time: string;
  similarity: number;
  result: 'HIT' | 'MISS';
  latency: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
}

export interface CompressionMetrics {
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  compressionRatio: number;
}

export interface TournamentMetrics {
  tournamentsCount: number;
  averageCandidates: number;
  averageJudgeScore: number;
  bestResponseRate: number;
}
