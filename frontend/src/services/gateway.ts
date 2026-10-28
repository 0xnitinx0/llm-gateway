import { apiRequest } from './api';
import { ApiKeyItem, ChatCompletionResponse, HealthResponse, LiveRequestResult, TournamentResponse } from '../types/gateway';

export async function checkGatewayHealth(): Promise<boolean> {
  try { return (await apiRequest<HealthResponse>('/health', { method: 'GET' }, 'none')).status === 'ok'; } catch { return false; }
}

export async function sendChatCompletion(prompt: string, apiKey: string, tournament = false, signal?: AbortSignal): Promise<LiveRequestResult> {
  if (!prompt.trim()) throw { detail: 'Please enter a prompt.', status: 400 };
  if (!apiKey.trim()) throw { detail: 'Please provide your Gateway API Key.', status: 401 };
  const started = performance.now();
  const headers = { 'X-Gateway-API-Key': apiKey.trim() };
  const messages = [{ role: 'user' as const, content: prompt.trim() }];
  if (tournament) {
    const data = await apiRequest<TournamentResponse>('/v1/tournaments', { method: 'POST', headers, body: JSON.stringify({ model: 'gateway-tournament', messages }), signal }, 'none');
    const winner = data.candidates.find(item => item.candidate_id === data.winner_id);
    return { response: data.winning_response, cache_hit: false, similarity: 0, provider: winner?.provider ?? data.judge.provider, model: winner?.model ?? data.judge.model, winning_model: winner?.model, winner_id: data.winner_id, judge_score: data.judge.scores[data.winner_id], judge: data.judge, candidates: data.candidates.map(item => ({ ...item, text: item.response ?? '' })), usage: data.usage, compression: data.compression, roundTripLatencyMs: Math.round(performance.now() - started), timestamp: new Date().toLocaleTimeString(), tournament: true };
  }
  const data = await apiRequest<ChatCompletionResponse>('/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: 'gateway-auto', messages, stream: false }), signal }, 'none');
  return { response: data.choices[0]?.message.content ?? '', cache_hit: data.gateway.cache_hit, similarity: data.gateway.similarity, provider: data.gateway.provider, model: data.gateway.model, usage: data.usage, compression: data.gateway.compression, gateway: data.gateway, routing: data.gateway.routing, roundTripLatencyMs: Math.round(performance.now() - started), timestamp: new Date().toLocaleTimeString(), tournament: false };
}

const mapKey = (item: any): ApiKeyItem => ({ id: item.id, name: item.name, maskedKey: item.masked_key, createdAt: item.created_at ?? new Date().toISOString(), lastUsed: item.last_used_at ?? null, status: item.status ?? 'active', rateLimitCapacity: item.rate_limit_capacity ?? 60, refillRatePerSecond: item.refill_rate_per_second ?? 1 });
export async function getApiKeys(): Promise<ApiKeyItem[]> { return (await apiRequest<any[]>('/v1/api-keys', { method: 'GET' }, 'admin')).map(mapKey); }
export async function createApiKey(name: string, rateLimitCapacity = 60, refillRatePerSecond = 1): Promise<{ key: ApiKeyItem; secretKey: string }> {
  const data = await apiRequest<any>('/v1/api-keys', { method: 'POST', body: JSON.stringify({ name, rate_limit_capacity: rateLimitCapacity, refill_rate_per_second: refillRatePerSecond }) }, 'admin');
  return { key: mapKey({ ...data, status: 'active', rate_limit_capacity: rateLimitCapacity, refill_rate_per_second: refillRatePerSecond }), secretKey: data.key };
}
export async function revokeApiKey(keyId: string): Promise<{ status: string }> { return apiRequest('/v1/api-keys/' + keyId, { method: 'DELETE' }, 'admin'); }
