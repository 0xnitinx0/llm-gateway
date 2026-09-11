import React from 'react';
import { Badge } from '../ui/Badge';
import { Database, Minimize2, Trophy, Info } from 'lucide-react';

export const IntelligencePreview: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Gateway Intelligence Preview
          </h3>
          <Badge variant="demo">DEMO / PREVIEW</Badge>
        </div>
        <span className="text-[11px] text-slate-400">
          Intended Gateway Architecture
        </span>
      </div>

      <div className="bg-amber-50/60 border border-amber-200/60 rounded-md p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Transparency Notice:</strong> The current FastAPI backend implements the raw LLM proxy and authentication. The optimization cards below show how responses will be annotated once the semantic cache, prompt compressor, and tournament evaluators are active.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Semantic Deduplication Card */}
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold">Semantic Cache</span>
            </div>
            <Badge variant="demo">DEMO</Badge>
          </div>
          <div className="pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-mono">0.91</span>
              <span className="text-xs text-slate-500">similarity score</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Near-duplicate query detected. Future responses can be served in &lt;120ms from vector cache.
            </p>
          </div>
        </div>

        {/* Prompt Compression Card */}
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Minimize2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold">Prompt Compression</span>
            </div>
            <Badge variant="demo">DEMO</Badge>
          </div>
          <div className="pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-mono">420 → 294</span>
              <span className="text-xs text-slate-500">tokens</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              30% token reduction achieved by stripping redundant syntactic boilerplate before provider dispatch.
            </p>
          </div>
        </div>

        {/* Multi-Model Tournament Card */}
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Trophy className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold">Response Tournament</span>
            </div>
            <Badge variant="planned">PLANNED</Badge>
          </div>
          <div className="pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 font-mono">3</span>
              <span className="text-xs text-slate-500">candidates</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Auto-evaluates Candidate A, B, and C. An LLM judge ranks output accuracy and selects the winner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
