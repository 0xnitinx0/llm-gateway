import { apiFetch, apiRequest, rateObservation, responseError } from './api';
import { CompressionResponse, GatewayMetadata, LiveRequestResult, RateObservation, TokenUsage } from '../types/gateway';

const payload = (prompt: string) => ({ messages: [{ role: 'user', content: prompt }] });
export const previewCompression = (prompt: string, key: string, signal?: AbortSignal): Promise<CompressionResponse> => apiRequest('/v1/tools/compress', { method: 'POST', headers: { 'X-Gateway-API-Key': key }, body: JSON.stringify(payload(prompt)), signal }, 'none');
export async function observeRateLimit(key: string, signal?: AbortSignal): Promise<RateObservation> {
  const response = await apiFetch('/v1/tools/compress', { method: 'POST', headers: { 'X-Gateway-API-Key': key }, body: JSON.stringify(payload('Explain token buckets.')), signal }, 'none');
  const observation = rateObservation(response);
  if (!response.ok) observation.detail = (await responseError(response)).detail;
  else await response.json();
  return observation;
}

// Decode incrementally: transport chunks can split UTF-8 characters and SSE frames.
export async function* readSSE(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const abort = () => { void reader.cancel(); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (data) yield data;
      }
      if (done) break;
    }
    if (buffer.trim()) throw { detail: 'Stream ended inside an SSE frame.', status: 502 };
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export async function streamChat(prompt: string, key: string, onText: (text: string) => void, signal: AbortSignal): Promise<LiveRequestResult> {
  const started = performance.now();
  const response = await apiFetch('/v1/chat/completions', { method: 'POST', headers: { 'X-Gateway-API-Key': key }, body: JSON.stringify({ ...payload(prompt), stream: true, stream_options: { include_usage: true } }), signal }, 'none');
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw { detail: 'Streaming response has no body.', status: 502 };
  let text = '';
  let gateway: GatewayMetadata | undefined;
  let usage: TokenUsage | undefined;
  let completed = false;
  for await (const data of readSSE(response.body, signal)) {
    if (data === '[DONE]') { completed = true; break; }
    const chunk = JSON.parse(data);
    if (chunk.error) throw { detail: chunk.error.message, status: 502 };
    text += chunk.choices?.[0]?.delta?.content ?? '';
    onText(text);
    if (chunk.gateway) gateway = chunk.gateway;
    if (chunk.usage) usage = chunk.usage;
  }
  if (!completed || !gateway || !usage) throw { detail: 'Stream interrupted before completion metadata arrived.', status: 502 };
  return { response: text, cache_hit: gateway.cache_hit, similarity: gateway.similarity, provider: gateway.provider, model: gateway.model, usage, compression: gateway.compression, gateway, routing: gateway.routing, roundTripLatencyMs: Math.round(performance.now() - started), timestamp: new Date().toLocaleTimeString(), tournament: false };
}
