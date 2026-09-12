import React from 'react';
import { Badge } from '../ui/Badge';
import { CopyButton } from '../common/CopyButton';
import { LiveRequestResult } from '../../types/gateway';
import { Clock, CheckCircle2, Bot } from 'lucide-react';

interface ResponseViewerProps {
  result: LiveRequestResult | null;
  isLoading: boolean;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  result,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Gateway Response</span>
            <Badge variant="live">LIVE</Badge>
          </div>
          <span className="text-xs text-blue-600 font-mono animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            Executing on Gateway...
          </span>
        </div>
        <div className="py-8 space-y-3">
          <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-4/6 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-slate-200 p-8 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Bot className="w-5 h-5 stroke-1" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700">Awaiting Request</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Submit a prompt above to dispatch a real completion request to the Gateway backend at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-[11px]">POST /v1/chat/completions</code>.
        </p>
      </div>
    );
  }

  const hasCandidates = result.candidates && result.candidates.length > 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {hasCandidates ? 'Tournament Mode Results' : 'Gateway Response'}
              </span>
              <Badge variant={result.cache_hit ? 'hit' : 'miss'}>
                {result.cache_hit ? 'CACHE HIT' : 'CACHE MISS'}
              </Badge>
              {result.provider && !hasCandidates && (
                <Badge variant="live">Provider: {result.provider.toUpperCase()}</Badge>
              )}
              {result.model && !hasCandidates && (
                <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                  {result.model}
                </span>
              )}
              {result.winning_model && (
                <Badge variant="live">Winner: {result.provider ? `${result.provider.toUpperCase()} (${result.winning_model})` : result.winning_model}</Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {result.cache_hit
                ? `Served from semantic vector cache (similarity: ${result.similarity})`
                : hasCandidates
                ? `Executed ${result.candidates?.length} providers in parallel. AI Judge selected winner with score ${result.judge_score}.`
                : result.provider
                ? `Routed to ${result.provider.toUpperCase()} (${result.model || ''})`
                : `Executed on LLM Provider (similarity: ${result.similarity})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Latency:</span>
            <strong className="text-slate-900 font-semibold">{result.roundTripLatencyMs}ms</strong>
          </div>
          <CopyButton textToCopy={result.response} label="Copy Winner" />
        </div>
      </div>

      {/* Candidates Breakdown for Tournament Mode */}
      {hasCandidates ? (
        <div className="p-5 space-y-4 bg-slate-50/40 border-b border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>Evaluated Candidates ({result.candidates?.length})</span>
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {result.candidates?.map((cand, idx) => {
              const isWinner = cand.model === result.winning_model || cand.provider === result.provider;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 transition-all ${
                    isWinner
                      ? 'bg-emerald-50/30 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 uppercase">
                        {cand.provider}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {cand.model}
                      </span>
                      {isWinner && (
                        <span className="text-[10px] font-bold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded tracking-wide">
                          Winner Selected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {cand.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Standard Response Body for Normal Mode */
        <div className="p-5 sm:p-6">
          <div className="prose prose-sm max-w-none text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans selection:bg-blue-100">
            {result.response}
          </div>
        </div>
      )}

      {/* Footer metadata */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">
          Similarity: <span className="text-slate-700 font-semibold">{result.similarity}</span>
        </span>
        <span>Completed at {result.timestamp}</span>
      </div>
    </div>
  );
};
