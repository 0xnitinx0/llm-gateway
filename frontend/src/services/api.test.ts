import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { mapCompression, mapDashboard, mapTournament, mapUsage } from './metrics';
import type { BackendUsageResponse } from '../types/gateway';

const snapshot: BackendUsageResponse = {
  total_requests: 10, cache_hits: 3, cache_misses: 4, cache_hit_rate: 42.86,
  active_cache_entries: 4, llm_calls: 9, llm_calls_avoided: 3,
  rate_limited_requests: 2, avg_latency_ms: 250, total_input_tokens: 100,
  total_output_tokens: 50, total_tokens: 150, compressed_tokens_saved: 20,
  costs: { currency: 'USD', baseline_spend_usd: 0.002, actual_spend_usd: 0.001, net_savings_usd: 0.001, cache_savings_usd: 0.0008, compression_savings_usd: 0.0002, tournament_overhead_usd: 0, priced_requests: 4, unpriced_requests: 2, configured_models: 2 },
  compression: { original_tokens: 120, compressed_tokens: 100, tokens_saved: 20, reduction_percent: 16.67 },
  tournaments: { count: 2, average_candidates: 3, average_winning_score: 0.8, judge_fallback_rate: 0 },
  history: [], recent_activity: [], similarity_distribution: [],
};

describe('live telemetry mappings', () => {
  it('maps zero-safe efficiency and tournament values', () => {
    expect(mapDashboard(snapshot)).toMatchObject({ tokensSaved: 20, callsAvoided: 3 });
    expect(mapUsage(snapshot)).toMatchObject({ llmCalls: 9, rateLimitedRequests: 2 });
    expect(mapCompression(snapshot).compressionRatio).toBe(16.67);
    expect(mapTournament(snapshot).averageWinningScore).toBe(0.8);
  });
});

describe('apiRequest', () => {
  beforeEach(() => {
    const values = new Map<string, string>([['admin_api_key', 'admin-test']]);
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
  });

  it('attaches the admin header', async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      expect(new Headers(options.headers).get('X-Admin-Key')).toBe('admin-test');
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/usage', {}, 'admin')).resolves.toEqual({ ok: true });
  });

  it('parses gateway errors and retry metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '5' } })));
    await expect(apiRequest('/v1/chat/completions', {}, 'none')).rejects.toMatchObject({ status: 429, retryAfter: 5, detail: 'Rate limit exceeded Retry after 5 seconds.' });
  });
});
