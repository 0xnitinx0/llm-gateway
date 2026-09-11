import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { ApiKeyInput } from '../components/playground/ApiKeyInput';
import { PromptEditor } from '../components/playground/PromptEditor';
import { ResponseViewer } from '../components/playground/ResponseViewer';
import { IntelligencePreview } from '../components/playground/IntelligencePreview';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { Card } from '../components/ui/Card';
import { sendChatCompletion } from '../services/gateway';
import { LiveRequestResult, ApiError } from '../types/gateway';
import { Terminal, Network } from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const PlaygroundPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [apiKey, setApiKey] = useState('gateway-secret-key');
  const [prompt, setPrompt] = useState(
    'Explain quantum computing in simple terms for a first-year computer science student.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LiveRequestResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError({ detail: 'Please enter a prompt before sending.', status: 400 });
      return;
    }
    if (!apiKey.trim()) {
      setError({ detail: 'Please provide a valid Gateway API Key.', status: 401 });
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const responseData = await sendChatCompletion(prompt, apiKey);
      setResult(responseData);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM Gateway Playground"
        description="Test requests through the unified Gateway API. The Gateway abstracts provider keys, models, and optimization under a single endpoint."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={gatewayOnline}
      />

      <div className="px-4 sm:px-8 max-w-6xl mx-auto space-y-6">
        {/* Architecture Reminder Banner */}
        <div className="rounded-lg bg-blue-50/60 border border-blue-200/80 p-3.5 flex items-center justify-between gap-4 text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <Network className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>One Unified API:</strong> You call <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-blue-800 border border-blue-200">POST /v1/chat/completions</code>. The Gateway manages routing, caching, and model execution on your behalf.
            </span>
          </div>
          <span className="hidden md:inline-block font-mono text-[10px] text-blue-700 font-semibold bg-white/70 px-2 py-0.5 rounded border border-blue-200">
            HTTP POST
          </span>
        </div>

        {/* Playground Request Console */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">Request Console</span>
            </div>
          }
          subtitle="Configure your Gateway key and prompt payload"
        >
          <div className="space-y-5">
            <ApiKeyInput
              apiKey={apiKey}
              setApiKey={setApiKey}
              disabled={isLoading}
            />

            <PromptEditor
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </div>
        </Card>

        {/* Error notification if any */}
        {error && (
          <ErrorAlert
            title={
              error.status === 401
                ? 'Authentication Failed (401)'
                : error.status === 500
                ? 'Gateway Processing Error (500)'
                : error.status === 0
                ? 'Gateway Unreachable'
                : 'Request Error'
            }
            message={error.detail}
            onRetry={handleSubmit}
          />
        )}

        {/* Response Area */}
        <ResponseViewer result={result} isLoading={isLoading} />

        {/* Gateway Intelligence Preview (Demonstrating intended optimizations) */}
        <IntelligencePreview />
      </div>
    </div>
  );
};
