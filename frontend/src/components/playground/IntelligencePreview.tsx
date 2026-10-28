import React from 'react';
import { Database, Minimize2, Trophy } from 'lucide-react';
import { LiveRequestResult } from '../../types/gateway';
import { Badge } from '../ui/Badge';

export const IntelligencePreview: React.FC<{ result: LiveRequestResult | null }> = ({ result }) => (
  <div className="gateway-card p-5 space-y-4">
    <div className="flex justify-between border-b pb-3"><h3 className="text-sm font-semibold">Gateway Intelligence</h3><Badge variant="live">{result ? 'Live Result' : 'Awaiting Request'}</Badge></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-lg border p-4"><Database className="w-4 h-4 text-accent-600 mb-2"/><p className="text-xs font-semibold">Semantic Cache</p><p className="text-xl font-mono font-bold">{result ? (result.cache_hit ? 'HIT' : 'MISS') : '--'}</p><p className="text-[11px] text-earth-500">Similarity {result?.similarity ?? '--'}</p></div>
      <div className="rounded-lg border p-4"><Minimize2 className="w-4 h-4 text-emerald-600 mb-2"/><p className="text-xs font-semibold">Prompt Compression</p><p className="text-xl font-mono font-bold">{result?.compression ? result.compression.tokens_saved + ' saved' : '--'}</p><p className="text-[11px] text-earth-500">{result?.compression ? result.compression.original_tokens + ' -> ' + result.compression.compressed_tokens + ' tokens' : 'No forwarded prompt yet'}</p></div>
      <div className="rounded-lg border p-4"><Trophy className="w-4 h-4 text-clay-600 mb-2"/><p className="text-xs font-semibold">Tournament</p><p className="text-xl font-mono font-bold">{result?.tournament ? result.candidates?.length + ' candidates' : '--'}</p><p className="text-[11px] text-earth-500">{result?.judge ? 'Winner ' + result.winner_id + ', score ' + result.judge_score : 'Standard completion'}</p></div>
    </div>
  </div>
);
