import React from 'react';
import { motion } from 'framer-motion';
import { useEntrance } from '../ui/motion';
import { Bot, CheckCircle2, Clock } from 'lucide-react';
import { LiveRequestResult } from '../../types/gateway';
import { Badge } from '../ui/Badge';
import { CopyButton } from '../common/CopyButton';

export const ResponseViewer: React.FC<{ result: LiveRequestResult | null; isLoading: boolean }> = ({ result, isLoading }) => {
  const entrance = useEntrance();
  if (isLoading) return <div role="status" className="gateway-card p-8 text-sm text-accent-600 animate-pulse">Executing on the gateway...</div>;
  if (!result) return <div className="gateway-card border-dashed p-8 text-center"><Bot className="w-5 h-5 mx-auto text-earth-500"/><p className="mt-2 text-sm text-earth-600">Submit a prompt to inspect the real gateway response and metadata.</p></div>;
  return <motion.div key={result.timestamp} variants={entrance} initial="hidden" animate="visible" className="gateway-card overflow-hidden">
    <div className="p-4 bg-earth-50 border-b flex flex-wrap justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600"/><strong className="text-sm">{result.tournament ? 'Tournament Result' : 'Gateway Response'}</strong>{!result.tournament && <Badge variant={result.cache_hit ? 'hit' : 'miss'}>{result.cache_hit ? 'CACHE HIT' : 'CACHE MISS'}</Badge>}<Badge variant="live">{result.provider}</Badge><span className="font-mono text-xs">{result.model}</span></div><div className="flex gap-3 items-center"><span className="text-xs font-mono flex gap-1"><Clock className="w-3 h-3"/>{result.roundTripLatencyMs} ms</span><CopyButton textToCopy={result.response}/></div></div>
    {result.candidates?.length ? <div className="p-5 space-y-3">{result.candidates.map(candidate => <div key={candidate.candidate_id} className={'rounded border p-4 ' + (candidate.candidate_id === result.winner_id ? 'border-emerald-300 bg-emerald-50' : '')}><div className="flex flex-wrap gap-2 text-xs font-semibold"><span>{candidate.candidate_id}</span><span>{candidate.provider}</span><span className="font-mono">{candidate.model}</span>{candidate.attempts && candidate.attempts > 1 && <span>{candidate.attempts} attempts</span>}{candidate.candidate_id === result.winner_id && <Badge variant="success">Winner</Badge>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{candidate.error ?? candidate.text}</p></div>)}{result.judge && <div className="rounded border border-clay-200 bg-clay-50 p-4 text-sm"><strong>Judge reasoning</strong><p className="mt-1">{result.judge.reasoning}</p><p className="mt-2 font-mono text-xs">Scores: {JSON.stringify(result.judge.scores)} {result.judge.fallback_used ? '(fallback)' : ''}</p></div>}</div> : <div className="p-6 whitespace-pre-wrap break-words text-sm">{result.response}</div>}
    <div className="p-3 bg-earth-50 border-t flex flex-wrap justify-between gap-3 text-[11px] text-earth-500"><span>Similarity: {result.similarity}</span><span>Tokens: {result.usage.prompt_tokens} in / {result.usage.completion_tokens} out</span><span>{result.compression ? result.compression.tokens_saved + ' compression tokens saved' : 'Served without compression'}</span><span>{result.timestamp}</span></div>
  </motion.div>;
};
