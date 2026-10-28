import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, CREDENTIAL_EVENT, rateObservation, refreshTelemetry, retrySeconds, setAdminApiKey, setGatewayApiKey, TELEMETRY_EVENT } from './api';
import { observeRateLimit, previewCompression, readSSE, streamChat } from './features';
import { sendChatCompletion } from './gateway';
import { sampleDemo } from './sampleDemo';
import { removedWords } from '../components/features/FeatureResults';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}
const gateway = { request_id: 'synthetic-request', provider: 'groq', model: 'fixture-model', cache_hit: false, similarity: 0.2, llm_called: true, latency_ms: 25, compression: null, routing: { status: 'routed', classification: { task_type: 'coding', complexity: 'medium', estimated_input_tokens: 5, context_size: 5, latency_sensitive: false }, provider_preference_order: ['groq', 'gemini'] } };
const usage = { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 };
const encoder = new TextEncoder();
function chunked(text: string, size = 1) {
  const bytes = encoder.encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close(); } });
}
function event(data: unknown) { return 'data: ' + JSON.stringify(data) + '\r\n\r\n'; }
beforeEach(() => { vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage()); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SSE transport and completion', () => {
  it('handles every byte boundary, split UTF-8, CRLF, comments and multi-line data', async () => {
    const body = chunked(': comment\r\n\r\ndata: café\r\ndata: second line\r\n\r\ndata: [DONE]\n\n');
    const frames = []; for await (const frame of readSSE(body)) frames.push(frame);
    expect(frames).toEqual(['café\nsecond line', '[DONE]']);
  });
  it('retains final routing, usage, cache and timing metadata', async () => {
    const body = event({ choices: [{ delta: { content: 'Hello é' } }] }) + event({ choices: [{ delta: {}, finish_reason: 'stop' }], gateway, usage }) + 'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(chunked(body), { headers: { 'Content-Type': 'text/event-stream' } })));
    const onText = vi.fn();
    const result = await streamChat('Write Python.', 'fixture-gateway', onText, new AbortController().signal);
    expect(result).toMatchObject({ response: 'Hello é', gateway, routing: gateway.routing, usage });
    expect(onText).toHaveBeenCalledWith('Hello é');
  });
  it('rejects provider errors and incomplete streams instead of reporting completion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(chunked(event({ error: { message: 'Candidate offline' } }) + 'data: [DONE]\n\n'))));
    await expect(streamChat('Hello', 'fixture', vi.fn(), new AbortController().signal)).rejects.toMatchObject({ detail: 'Candidate offline', status: 502 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(chunked(event({ choices: [{ delta: { content: 'partial' } }] })))));
    await expect(streamChat('Hello', 'fixture', vi.fn(), new AbortController().signal)).rejects.toMatchObject({ status: 502 });
    const collect = async () => { for await (const frame of readSSE(chunked('data: broken'))) void frame; };
    await expect(collect()).rejects.toMatchObject({ detail: 'Stream ended inside an SSE frame.' });
  });
  it('cancels a blocked reader promptly and preserves AbortError', async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const next = readSSE(body, controller.signal).next();
    controller.abort();
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Stopped', 'AbortError'); }));
    await expect(apiRequest('/health', { signal: controller.signal }, 'none')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('live requests and headers', () => {
  it('maps regular response routing without fabricating decisions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'answer' } }], gateway, usage }))));
    expect(await sendChatCompletion('Hello', 'fixture')).toMatchObject({ routing: gateway.routing, gateway });
  });
  it('sends compression previews with the explicit key', async () => {
    const value = sampleDemo.compress('Could you please explain caching.');
    const fetch = vi.fn(async (_path: string, options: RequestInit) => { expect(new Headers(options.headers).get('X-Gateway-API-Key')).toBe('fixture'); expect(JSON.parse(options.body as string).messages[0].content).toBe('Original'); return new Response(JSON.stringify(value)); });
    vi.stubGlobal('fetch', fetch);
    await expect(previewCompression('Original', 'fixture')).resolves.toEqual(value);
  });
  it('captures 429 and 401 response headers as evidence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Bucket empty' } }), { status: 429, headers: { 'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '0', 'Retry-After': '5' } })));
    expect(await observeRateLimit('fixture')).toMatchObject({ status: 429, limit: 3, remaining: 0, retryAfter: 5 });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Revoked' } }), { status: 401 })));
    expect(await observeRateLimit('fixture')).toMatchObject({ status: 401, remaining: null, retryAfter: null, detail: 'Revoked' });
  });
  it('uses a deadline for retry countdowns and never goes negative', () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const row = rateObservation(new Response('', { status: 429, headers: { 'Retry-After': '5' } }));
    expect(retrySeconds(row)).toBe(5);
    vi.advanceTimersByTime(1100); expect(retrySeconds(row)).toBe(4);
    vi.advanceTimersByTime(3900); expect(retrySeconds(row)).toBe(0);
    vi.advanceTimersByTime(60000); expect(retrySeconds(row)).toBe(0);
  });
});

describe('session updates and sample isolation', () => {
  it('announces credential changes and reads updated credentials on each call', async () => {
    const changed = vi.fn(); window.addEventListener(CREDENTIAL_EVENT, changed);
    const headers: Headers[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => { headers.push(new Headers(options.headers)); return new Response('{}'); }));
    setAdminApiKey(' admin-one '); await apiRequest('/usage', {}, 'admin');
    setAdminApiKey('admin-two'); await apiRequest('/usage', {}, 'admin');
    setGatewayApiKey('gateway-one'); await apiRequest('/v1/tools/compress');
    expect(headers.map(header => header.get('X-Admin-Key'))).toEqual(['admin-one', 'admin-two', null]);
    expect(headers[2].get('X-Gateway-API-Key')).toBe('gateway-one');
    expect(changed).toHaveBeenCalledTimes(3);
    setAdminApiKey(''); await expect(apiRequest('/usage', {}, 'admin')).rejects.toMatchObject({ status: 401 });
  });
  it('announces completed telemetry refreshes', () => {
    const refresh = vi.fn(); window.addEventListener(TELEMETRY_EVENT, refresh);
    refreshTelemetry(); expect(refresh).toHaveBeenCalledOnce();
  });
  it('sample actions never fetch and include honest illustrative failure examples', () => {
    const fetch = vi.fn(() => { throw new Error('Samples must not fetch'); }); vi.stubGlobal('fetch', fetch);
    sampleDemo.compress('Could you please explain caching.'); sampleDemo.chat('initial', 'Hello');
    expect(sampleDemo.chat('repeat', 'Hello').cache_hit).toBe(true);
    expect(sampleDemo.chat('paraphrase', 'Hello').cache_hit).toBe(false);
    expect(sampleDemo.tournament().candidates?.some(item => item.error)).toBe(true);
    expect(sampleDemo.rates().map(row => row.status)).toEqual([200, 200, 200, 429]);
    sampleDemo.rates(true); expect(fetch).not.toHaveBeenCalled();
  });
  it('highlights duplicate removals without marking retained occurrences', () => {
    const words = removedWords('Please explain caching. Explain caching.', 'Explain caching.');
    expect(words.filter(word => !word.removed).map(word => word.text.trim()).join(' ')).toBe('Explain caching.');
    expect(words.filter(word => word.removed).map(word => word.text.trim()).join(' ')).toBe('Please explain caching.');
  });
});
