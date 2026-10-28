// Illustrative fixtures are kept behind an explicit adapter. No network imports.
import { CompressionResponse, LiveRequestResult, RateObservation } from '../types/gateway';
const usage = { prompt_tokens: 32, completion_tokens: 48, total_tokens: 80 };
const response = 'Semantic caching compares embeddings to stored requests. A sufficiently similar request can reuse an answer and avoid a provider call. A miss proceeds through compression and routing.';
export const sampleDemo = {
  compress(prompt: string): CompressionResponse {
    const compressed = prompt.replace(/Could you please /i, '').replace(/ Thank you\./i, '');
    return { original_messages: [{ role: 'user', content: prompt }], compressed_messages: [{ role: 'user', content: compressed }], metrics: { strategy: 'Illustrative sample', original_tokens: 50, compressed_tokens: 42, tokens_saved: 8, reduction_percent: 16 } };
  },
  chat(kind: string, prompt: string): LiveRequestResult {
    const hit = kind === 'repeat';
    const task = /python|code/i.test(prompt) ? 'coding' : /prove|reason|tradeoff/i.test(prompt) ? 'reasoning' : 'simple';
    return { response, cache_hit: hit, similarity: hit ? 1 : kind === 'paraphrase' ? 0.71 : 0, provider: 'sample-provider', model: 'illustrative-model', usage, compression: null, roundTripLatencyMs: hit ? 14 : 240, timestamp: new Date().toLocaleTimeString(), tournament: false, routing: { status: hit ? 'skipped' : 'routed', classification: hit ? null : { task_type: task, complexity: task === 'simple' ? 'low' : 'medium', estimated_input_tokens: 32, context_size: 32, latency_sensitive: task === 'simple' }, provider_preference_order: hit ? [] : ['sample-provider', 'sample-fallback'] } };
  },
  tournament(): LiveRequestResult {
    return { ...this.chat('initial', ''), tournament: true, winner_id: 'sample-a', winning_model: 'illustrative-a', judge: { provider: 'sample-judge', model: 'illustrative-judge', scores: { 'sample-a': 0.9, 'sample-b': 0.72 }, reasoning: 'Illustrative judgment: A explains similarity and the miss path more clearly.', fallback_used: false }, candidates: [{ candidate_id: 'sample-a', provider: 'sample-a', model: 'illustrative-a', text: response, latency_ms: 240, usage }, { candidate_id: 'sample-b', provider: 'sample-b', model: 'illustrative-b', text: 'Store and reuse answers for similar questions.', latency_ms: 190, usage }, { candidate_id: 'sample-c', provider: 'sample-c', model: 'illustrative-c', text: '', latency_ms: 60, error: 'Illustrative provider failure' }] };
  },
  rates(retry = false): RateObservation[] {
    return (retry ? [200] : [200, 200, 200, 429]).map((status, index) => ({ status, remaining: retry ? 0 : Math.max(0, 2 - index), limit: 3, retryAfter: status === 429 ? 5 : null, observedAt: Date.now(), detail: status === 429 ? 'Illustrative bucket exhausted' : undefined }));
  },
};
