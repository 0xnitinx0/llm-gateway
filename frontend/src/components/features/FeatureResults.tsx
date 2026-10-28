import React from 'react';
import { CompressionResponse, LiveRequestResult, RateObservation } from '../../types/gateway';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

// Align original and compressed words to highlight removals, including repeated words.
export function removedWords(original: string, compressed: string): Array<{ text: string; removed: boolean }> {
  const a = original.match(/\S+\s*/g) ?? [];
  const b = compressed.match(/\S+/g) ?? [];
  // Bound quadratic work for arbitrarily long user prompts.
  if (a.length * b.length > 250000) return [{ text: original, removed: false }];
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i].trim() === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const kept = new Set<number>();
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].trim() === b[j]) { kept.add(i++); j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return a.map((text, index) => ({ text, removed: !kept.has(index) }));
}
export function CompressionResults({ result }: { result: CompressionResponse }) {
  const original = result.original_messages.map(item => item.content).join('\n');
  const compressed = result.compressed_messages.map(item => item.content).join('\n');
  return <div className="space-y-4 result-reveal">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Original tokens', result.metrics.original_tokens], ['Compressed tokens', result.metrics.compressed_tokens], ['Tokens removed', result.metrics.tokens_saved], ['Reduction', result.metrics.reduction_percent + '%']].map(([label, value]) => <div key={label} className="evidence-stat"><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="grid md:grid-cols-2 gap-4"><Card title="Original prompt" subtitle="Highlighted words were removed"><p className="whitespace-pre-wrap text-sm leading-7 break-words">{removedWords(original, compressed).map((word, index) => word.removed ? <mark key={index} className="bg-[#F4D5BF] text-earth-800 line-through decoration-earth-500">{word.text}</mark> : <React.Fragment key={index}>{word.text}</React.Fragment>)}</p></Card><Card title="Compressed prompt" subtitle={result.metrics.strategy}><pre className="text-sm whitespace-pre-wrap leading-7 break-words">{compressed}</pre></Card></div>
  </div>;
}
export function ChatResults({ result }: { result: LiveRequestResult }) {
  return <div className="space-y-4 result-reveal"><div className="flex flex-wrap gap-2"><Badge variant={result.cache_hit ? 'hit' : 'miss'}>{result.cache_hit ? 'Cache hit' : 'Cache miss'}</Badge><Badge variant="neutral">{result.provider} / {result.model}</Badge>{result.provider.startsWith('local') && <Badge variant="warning">Local simulated inference</Badge>}<span className="text-xs text-earth-500 self-center">{result.roundTripLatencyMs} ms round trip · {result.usage.total_tokens} tokens</span></div>
    <RoutingEvidence result={result} />
    <div className="border rounded-lg p-5 bg-surface whitespace-pre-wrap text-sm leading-7 break-words">{result.response}</div>
  </div>;
}
export function RoutingEvidence({ result }: { result: LiveRequestResult }) {
  const route = result.routing;
  return <div className="border rounded-lg bg-earth-50 p-4 text-xs space-y-2">
    {route?.status === 'skipped' ? <p>Routing skipped: the cached answer was reused.</p> : route ? <><p><strong>Classification:</strong> {route.classification?.task_type} · {route.classification?.complexity} complexity · {route.classification?.estimated_input_tokens} forwarded input tokens</p><p><strong>Provider preference:</strong> {route.provider_preference_order.join(' → ') || 'None available'}</p><p><strong>Selected:</strong> {result.provider} / {result.model}</p></> : <p>Routing metadata unavailable from this backend.</p>}
  </div>;
}
export function CacheResults({ entries }: { entries: Array<{ label: string; result: LiveRequestResult }> }) {
  return <div className="space-y-4"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="text-left text-earth-500 pb-3">Actual lookup outcomes. A paraphrase may miss the configured similarity threshold.</caption><thead><tr><th className="p-3">Request</th><th>Outcome</th><th>Similarity</th><th>Round trip</th><th>Calls avoided</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={index} className="border-t"><td className="p-3">{entry.label}</td><td><Badge variant={entry.result.cache_hit ? 'hit' : 'miss'}>{entry.result.cache_hit ? 'HIT' : 'MISS'}</Badge></td><td>{entry.result.similarity.toFixed(4)}</td><td>{entry.result.roundTripLatencyMs} ms</td><td>{entry.result.cache_hit ? 1 : 0}</td></tr>)}</tbody></table></div>{entries.length > 0 && <ChatResults result={entries[entries.length - 1].result} />}</div>;
}
export function TournamentResults({ result }: { result: LiveRequestResult }) {
  return <div className="space-y-4 result-reveal"><div className="border border-emerald-300 bg-emerald-50 rounded-lg p-4"><p className="text-xs uppercase tracking-wider text-emerald-700">Winner · {result.winner_id}</p><h3 className="text-xl font-semibold text-earth-900 mt-1">{result.winning_model}</h3><p className="text-sm mt-2 whitespace-pre-wrap break-words">{result.response}</p></div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{result.candidates?.map(candidate => <Card key={candidate.candidate_id} title={candidate.provider} subtitle={candidate.model} className={candidate.candidate_id === result.winner_id ? 'border-emerald-300' : ''}><div className="text-xs text-earth-500 mb-3 flex flex-wrap gap-2"><span>Score: {result.judge?.scores[candidate.candidate_id] ?? '—'}</span><span>{candidate.latency_ms} ms</span><span>{candidate.usage?.total_tokens ?? '—'} tokens</span></div>{candidate.error ? <p role="alert" className="text-sm text-red-700">Failed: {candidate.error}</p> : <p className="text-sm whitespace-pre-wrap leading-6 break-words">{candidate.text}</p>}</Card>)}</div>
    <Card title="Judge reasoning" subtitle={result.judge ? `${result.judge.provider} / ${result.judge.model} · ${result.judge.fallback_used ? 'Fallback used' : 'Primary judgment'}` : undefined}><p className="text-sm leading-6 whitespace-pre-wrap break-words">{result.judge?.reasoning ?? 'No reasoning returned.'}</p><p className="text-xs mt-3 text-earth-500">Total usage: {result.usage.total_tokens} tokens · {result.roundTripLatencyMs} ms round trip</p></Card>
  </div>;
}
export function RateResults({ observations }: { observations: RateObservation[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="text-left text-earth-500 pb-3">Compression previews consume the bucket without calling a provider.</caption><thead><tr><th className="p-3">Request</th><th>HTTP</th><th>Remaining / limit</th><th>Retry-After</th></tr></thead><tbody>{observations.map((row, index) => <tr key={index} className="border-t"><td className="p-3">{index + 1}</td><td><Badge variant={row.status === 429 ? 'warning' : row.status === 200 ? 'success' : 'error'}>{row.status || 'Offline'}</Badge>{row.detail && <p className="text-earth-500 max-w-64 whitespace-normal mt-1">{row.detail}</p>}</td><td>{row.remaining ?? '—'} / {row.limit ?? '—'}</td><td>{row.retryAfter === null ? '—' : row.retryAfter + 's'}</td></tr>)}</tbody></table></div>;
}
