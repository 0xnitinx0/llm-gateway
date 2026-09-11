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

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Gateway Response</span>
              <Badge variant="live">LIVE</Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              Response received from the FastAPI Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Round-trip Latency:</span>
            <strong className="text-slate-900 font-semibold">{result.roundTripLatencyMs}ms</strong>
          </div>
          <CopyButton textToCopy={result.response} label="Copy" />
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6">
        <div className="prose prose-sm max-w-none text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans selection:bg-blue-100">
          {result.response}
        </div>
      </div>

      {/* Footer metadata */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">
          Contract: <span className="text-slate-700">{'{"response": "<string>"}'}</span>
        </span>
        <span>Completed at {result.timestamp}</span>
      </div>
    </div>
  );
};
