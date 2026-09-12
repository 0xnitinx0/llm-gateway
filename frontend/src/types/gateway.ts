// Real backend contract types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GatewayChatRequest {
  messages: ChatMessage[];
  tournament?: boolean;
}

export interface CandidateResult {
  provider: string;
  model: string;
  text: string;
  usage?: any;
}

export interface GatewayChatResponse {
  response: string;
  cache_hit: boolean;
  similarity: number;
  winning_model?: string | null;
  judge_score?: number | null;
  provider?: string | null;
  model?: string | null;
  candidates?: CandidateResult[] | null;
  candidate_count?: number | null;
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
  cache_hit: boolean;
  similarity: number;
  winning_model?: string | null;
  judge_score?: number | null;
  provider?: string | null;
  model?: string | null;
  candidates?: CandidateResult[] | null;
  candidate_count?: number | null;
  roundTripLatencyMs: number;
  timestamp: string;
  tournament?: boolean;
}

export interface BackendUsageResponse {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;
  llm_calls: number;
  llm_calls_avoided: number;
  avg_latency_ms: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_tokens: number | null;
  actual_provider_cost: number | null;
  estimated_cost_without_gateway: number | null;
  estimated_cost_saved: number | null;
  estimated_cost: number | null;
  estimated_savings: number | null;
  history?: RequestDataPoint[];
  recent_activity?: ActivityLogItem[];
  similarity_distribution?: SimilarityBucket[];
}

// Observability & Metric Types
export interface DashboardMetrics {
  totalRequests: number;
  cacheHitRate: number;
  tokensSaved: number | null;
  estimatedSavings: number | null;
  averageLatencySec: number | null;
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
  tokensSaved: number | null;
  estimatedCostSaved: number | null;
  actualProviderCost: number | null;
  estimatedCostWithoutGateway: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
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
