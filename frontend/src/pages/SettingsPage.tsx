import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatusDot } from '../components/common/StatusDot';
import { CopyButton } from '../components/common/CopyButton';
import {
  Server,
  Database,
  User,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { checkGatewayHealth } from '../../src/services/gateway';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const SettingsPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline: contextOnline } = useOutletContext<OutletContextType>();

  const [threshold, setThreshold] = useState('0.75');
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [liveStatus, setLiveStatus] = useState<boolean | null>(contextOnline);
  const [savedNotice, setSavedNotice] = useState(false);

  const endpointUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handleTestConnection = async () => {
    setIsChecking(true);
    try {
      const isOk = await checkGatewayHealth();
      setLiveStatus(isOk);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveSimulatedSettings = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const currentOnline = liveStatus ?? contextOnline;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your Gateway workspace, telemetry thresholds, and environment targets."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={currentOnline}
      />

      <div className="px-4 sm:px-8 max-w-4xl mx-auto space-y-6">
        {/* Gateway Infrastructure Section */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">Gateway Infrastructure</span>
            </div>
          }
          subtitle="Connection details and health telemetry for the FastAPI gateway"
          headerAction={<Badge variant="live">LIVE</Badge>}
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-700">Gateway Status</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verified against <code className="font-mono text-slate-700">GET /health</code>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot
                  status={currentOnline === null ? 'checking' : currentOnline ? 'online' : 'offline'}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isChecking}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Test Connection
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Target Backend Endpoint
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={endpointUrl}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-800 focus:outline-none"
                />
                <CopyButton textToCopy={endpointUrl} label="Copy Endpoint" />
              </div>
              <p className="text-[11px] text-slate-500">
                In development, the Vite dev server transparently proxies browser requests from <code className="font-mono text-slate-700">/api/*</code> to <code className="font-mono text-slate-700">http://127.0.0.1:8000/*</code> to eliminate CORS friction.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Active Provider</span>
                <p className="font-semibold text-slate-900">GeminiProvider (google-genai)</p>
                <p className="text-slate-500 text-[11px]">Model: gemini-3.5-flash</p>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
                <span className="text-slate-400 uppercase font-semibold text-[10px]">Auth Scheme</span>
                <p className="font-semibold text-slate-900">X-Gateway-API-Key</p>
                <p className="text-slate-500 text-[11px]">Enforced via FastAPI Security</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Semantic Cache Configuration (Demo / Simulated) */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">Semantic Deduplication Engine</span>
            </div>
          }
          subtitle="Tune vector similarity matching parameters"
          headerAction={<Badge variant="demo">DEMO / PREVIEW</Badge>}
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-md flex items-start gap-2.5 text-xs text-amber-800">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Simulation Notice:</strong> Backend configuration mutation endpoints are planned for upcoming phases. Adjusting these parameters illustrates the upcoming configuration interface.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Similarity Match Threshold
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Minimum cosine similarity required to trigger a cache hit (0.50 to 0.99)
                  </p>
                </div>
                <span className="text-sm font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {threshold}
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-800">Semantic Cache Enabled</span>
                <p className="text-[11px] text-slate-500">
                  Intercept incoming queries for vector lookup before provider routing
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCacheEnabled(!cacheEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors focus:outline-none ${
                  cacheEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    cacheEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-800">Adaptive Prompt Compression</span>
                <p className="text-[11px] text-slate-500">
                  Automatically strip non-essential syntactic tokens from context
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompressionEnabled(!compressionEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors focus:outline-none ${
                  compressionEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    compressionEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {savedNotice ? (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simulated preferences saved
                </span>
              ) : <span />}

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSimulatedSettings}
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </Card>

        {/* Developer Account Card */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">Developer Account</span>
            </div>
          }
          subtitle="Authenticated workspace context"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500">Account Owner</span>
                <p className="font-semibold text-slate-900 mt-0.5">developer@example.com</p>
              </div>
              <div>
                <span className="text-slate-500">Account Status</span>
                <div className="mt-0.5">
                  <Badge variant="success">Active</Badge>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Deployment Tier</span>
                <p className="font-semibold text-slate-900 mt-0.5">Developer Edition (v0.1.0)</p>
              </div>
              <div>
                <span className="text-slate-500">Cloud Target</span>
                <p className="font-semibold text-slate-900 mt-0.5">AWS Architecture (Planned)</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
