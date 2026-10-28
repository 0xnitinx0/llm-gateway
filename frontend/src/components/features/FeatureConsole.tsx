import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../state/WorkspaceSession';
import { previewCompression, observeRateLimit, streamChat } from '../../services/features';
import { sendChatCompletion } from '../../services/gateway';
import { refreshTelemetry, retrySeconds } from '../../services/api';
import { sampleDemo } from '../../services/sampleDemo';
import { ApiError, LiveRequestResult } from '../../types/gateway';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CacheResults, ChatResults, CompressionResults, RateResults, TournamentResults } from './FeatureResults';

export type Feature = 'compression' | 'cache' | 'chat' | 'tournament' | 'rate';
const presets = {
  Simple: 'What is the capital of France? Reply in one sentence.',
  Coding: 'Write a Python function that implements a token bucket rate limiter. Explain the code.',
  Reasoning: 'Compare the tradeoffs of semantic caching and exact-match caching. Reason step by step about correctness, latency, and cost.',
};
export const featureCopy: Record<Feature, { title: string; description: string }> = {
  compression: { title: 'Compress a prompt', description: 'Preview the actual compressor output without calling a provider.' },
  cache: { title: 'Observe semantic reuse', description: 'Send a request, repeat it, then test a paraphrase. Every outcome comes from the cache lookup.' },
  chat: { title: 'Route and stream', description: 'Inspect the actual classification and provider preference, then watch the answer arrive.' },
  tournament: { title: 'Compare candidate answers', description: 'Run cloud candidates in parallel and inspect the judge’s scores and reasoning.' },
  rate: { title: 'Observe the token bucket', description: 'Four compression previews against a dedicated capacity-3 key. Timing and previous use can change the result.' },
};
export function FeatureConsole({ feature, onBusy, guided = false }: { feature: Feature; guided?: boolean; onBusy?: (value: boolean) => void }) {
  const session = useWorkspace();
  const { presentation: state, updatePresentation: update, mode } = session;
  const [prompt, setPrompt] = useState(presets.Simple);
  const [paraphrase, setParaphrase] = useState('In three sentences, describe how similar questions can reuse cached answers and avoid another model call.');
  const [streaming, setStreaming] = useState(true);
  const [partial, setPartial] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [now, setNow] = useState(Date.now());
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const key = guided ? session.demoKey || session.gatewayKey : session.gatewayKey || session.demoKey;
  const live = mode === 'live';
  const blocked = live && (!key || !session.ready);
  const lastRate = state.rates[state.rates.length - 1];
  const countdown = lastRate?.status === 429 ? retrySeconds(lastRate, now) : 0;
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (!lastRate?.retryAfter) return; const interval = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(interval); }, [lastRate]);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setError(null); setStatus('Running'); setBusy(true); onBusy?.(true);
    try { await action(abort.signal); if (active.current) setStatus(live ? 'Completed' : 'Sample result complete'); }
    catch (reason) {
      if (active.current) {
        if (abort.signal.aborted) setStatus('Stopped · partial output is not a completed result');
        else { setStatus('Failed'); setError((reason as ApiError).detail ? reason as ApiError : { detail: (reason as Error).message || 'Request failed.' }); }
      }
    } finally {
      controller.current = null;
      if (live) refreshTelemetry();
      if (active.current) { setBusy(false); onBusy?.(false); }
    }
  };
  const compress = () => run(async signal => { update({ compression: undefined }); const value = live ? await previewCompression(state.prompt, key, signal) : sampleDemo.compress(state.prompt); if (!signal.aborted) update({ compression: value }); });
  const cache = (kind: 'initial' | 'repeat' | 'paraphrase') => run(async signal => {
    const base = `${state.cachePrompt}\nSynthetic session scenario: ${state.nonce}.`;
    const text = kind === 'repeat' ? state.cacheBase! : kind === 'paraphrase' ? `${paraphrase}\nSynthetic session scenario: ${state.nonce}.` : base;
    const result = live ? await sendChatCompletion(text, key, false, signal) : sampleDemo.chat(kind, text);
    if (!signal.aborted) update(current => ({ ...current, cacheBase: kind === 'initial' ? text : current.cacheBase, cache: kind === 'initial' ? [{ label: 'Initial', result }] : [...current.cache, { label: kind === 'repeat' ? 'Repeat' : 'Paraphrase', result }] }));
  });
  const chat = () => run(async signal => {
    setPartial(''); update({ routing: undefined });
    const result = live ? streaming ? await streamChat(prompt, key, text => { if (active.current) setPartial(text); }, signal) : await sendChatCompletion(prompt, key, false, signal) : sampleDemo.chat('routing', prompt);
    if (!signal.aborted) { update({ routing: result }); setPartial(''); }
  });
  const tournament = () => run(async signal => { update({ tournament: undefined }); const result = live ? await sendChatCompletion(prompt, key, true, signal) : sampleDemo.tournament(); if (!signal.aborted) update({ tournament: result }); });
  const rates = (retry = false) => run(async signal => {
    if (!retry) update({ rates: [] });
    if (!live) { const observations = sampleDemo.rates(retry); update(current => ({ ...current, rates: retry ? [...current.rates, ...observations] : observations })); return; }
    for (let index = 0; index < (retry ? 1 : 4); index++) {
      try {
        const row = await observeRateLimit(session.rateKey, signal);
        if (!signal.aborted) update(current => ({ ...current, rates: [...current.rates, row] }));
      } catch (reason) {
        if (!signal.aborted) update(current => ({ ...current, rates: [...current.rates, { status: (reason as ApiError).status ?? 0, remaining: null, limit: null, retryAfter: null, observedAt: Date.now(), detail: (reason as ApiError).detail }] }));
        throw reason;
      }
    }
  });
  const buttonDisabled = busy || blocked;
  return <section className="space-y-5 min-w-0" aria-label={featureCopy[feature].title}>
    <Card title={featureCopy[feature].title} subtitle={featureCopy[feature].description}>
      <div className="space-y-4">
        {blocked && <p className="text-sm text-earth-600 bg-earth-50 p-3 border rounded-lg">{!key ? 'A gateway key is required. Save one or prepare a session in the first step.' : 'Backend readiness is unavailable. Check the connection or explicitly switch to the sample walkthrough.'}</p>}
        {feature === 'compression' && <><label className="block text-xs font-semibold">Synthetic prompt<textarea value={state.prompt} onChange={e => update({ prompt: e.target.value })} disabled={busy} rows={6} className="mt-2 w-full border px-3 py-3 text-sm leading-6 resize-y" /></label><Button size="sm" onClick={compress} disabled={buttonDisabled || !state.prompt.trim()}>Preview compression</Button></>}
        {feature === 'cache' && <><label className="block text-xs font-semibold">Initial request<textarea value={state.cachePrompt} onChange={e => update({ cachePrompt: e.target.value })} disabled={busy} rows={3} className="mt-2 w-full border p-3 text-sm" /></label><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => cache('initial')} disabled={buttonDisabled || !state.cachePrompt.trim()}>Send initial request</Button><Button size="sm" variant="secondary" onClick={() => cache('repeat')} disabled={buttonDisabled || !state.cacheBase}>Repeat exact request</Button></div><details className="border-t pt-3"><summary className="text-xs font-semibold cursor-pointer">Optional paraphrase</summary><label className="block text-xs mt-3">Paraphrased request<textarea value={paraphrase} onChange={e => setParaphrase(e.target.value)} disabled={busy} rows={3} className="mt-2 w-full border p-3 text-sm" /></label><Button size="sm" variant="secondary" onClick={() => cache('paraphrase')} disabled={buttonDisabled || !state.cacheBase || !paraphrase.trim()}>Try paraphrase</Button></details></>}
        {(feature === 'chat' || feature === 'tournament') && <><div className="flex flex-wrap gap-2" aria-label="Prompt presets">{Object.entries(presets).map(([name, text]) => <Button size="sm" variant="secondary" key={name} disabled={busy} onClick={() => setPrompt(text)}>{name}</Button>)}</div><label className="block text-xs font-semibold">Request prompt<textarea value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy} rows={5} className="mt-2 w-full border p-3 text-sm leading-6" /></label>{feature === 'chat' && <label className="flex gap-2 text-sm"><input type="checkbox" checked={streaming} onChange={e => setStreaming(e.target.checked)} disabled={busy} />Stream response</label>}{feature === 'tournament' && live && <p className="text-xs text-earth-600">{session.config?.tournament_readiness?.ready ? 'Configuration ready. Candidates or judge may still fail during inference.' : session.config?.tournament_readiness?.reason ?? 'Tournament configuration unavailable. Verify admin access in Prepare.'}</p>}<div className="flex gap-2"><Button size="sm" onClick={feature === 'chat' ? chat : tournament} disabled={buttonDisabled || !prompt.trim() || (feature === 'tournament' && live && !session.config?.tournament_readiness?.ready)}>{feature === 'chat' ? streaming ? 'Start stream' : 'Send request' : 'Run tournament'}</Button>{busy && <Button size="sm" variant="secondary" onClick={() => controller.current?.abort()}>Stop</Button>}</div></>}
        {feature === 'rate' && <><p className="text-sm">The demo bucket holds 3 requests and refills one request every 5 seconds. Preview requests avoid inference costs.</p>{live && !session.rateKey && <p className="text-sm text-earth-600">Prepare the dedicated rate-limit key in the demo’s first step.</p>}<div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => rates()} disabled={busy || (live && (!session.rateKey || !session.ready))}>Send four previews</Button>{lastRate?.status === 429 && <Button size="sm" variant="secondary" onClick={() => rates(true)} disabled={busy || countdown > 0 || (live && !session.ready)}>{countdown > 0 ? `Retry in ${countdown}s` : 'Retry one request'}</Button>}</div>{lastRate?.status === 429 && <p role="timer" className="text-xs text-earth-600">Retry-After: {countdown > 0 ? `${countdown}s remaining` : 'ready to retry'}. The server determines the next outcome.</p>}</>}
        <div aria-live="polite" className="text-xs text-earth-500">{status}</div>
        {error && <div role="alert" className="border border-red-200 rounded-lg p-3 bg-red-50 text-sm text-red-700"><strong>{error.status === 401 ? 'Authentication failed' : error.status === 0 ? 'Service offline' : error.status === 429 ? 'Rate limited' : 'Request failed'}</strong><p className="mt-1">{error.detail}</p>{error.requestId && <p className="text-xs mt-2">Request: {error.requestId}</p>}</div>}
      </div>
    </Card>
    {feature === 'compression' && state.compression && <CompressionResults result={state.compression} />}
    {feature === 'cache' && state.cache.length > 0 && <CacheResults entries={state.cache} />}
    {feature === 'chat' && state.routing && <ChatResults result={state.routing} />}
    {feature === 'chat' && partial && <Card title={busy ? 'Streaming response' : 'Partial response'}><pre className="text-sm whitespace-pre-wrap leading-7 break-words">{partial}</pre></Card>}
    {feature === 'tournament' && state.tournament && <TournamentResults result={state.tournament} />}
    {feature === 'rate' && state.rates.length > 0 && <Card title="Request evidence"><RateResults observations={state.rates} /></Card>}
  </section>;
}
export function ResultEvidence({ result }: { result?: LiveRequestResult }) {
  return result ? <dl className="text-xs space-y-3"><div><dt className="text-earth-500">Provider / model</dt><dd className="font-semibold break-words">{result.provider} / {result.model}</dd></div><div><dt className="text-earth-500">Cache similarity</dt><dd>{result.similarity.toFixed(4)}</dd></div><div><dt className="text-earth-500">Latency</dt><dd>{result.roundTripLatencyMs} ms round trip{result.gateway ? ` · ${result.gateway.latency_ms} ms server` : ''}</dd></div><div><dt className="text-earth-500">Token usage</dt><dd>{result.usage.prompt_tokens} input · {result.usage.completion_tokens} output</dd></div>{result.gateway && <div><dt className="text-earth-500">Request ID</dt><dd className="font-mono break-all">{result.gateway.request_id}</dd></div>}</dl> : <p className="text-sm text-earth-500">Run the step to collect evidence. No request is sent when you enter a step.</p>;
}
