import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, CREDENTIAL_EVENT, getAdminApiKey, getGatewayApiKey, TELEMETRY_EVENT } from '../services/api';
import { getRuntimeConfig, getUsageSnapshot } from '../services/metrics';
import { ApiError, BackendUsageResponse, CompressionResponse, LiveRequestResult, RateObservation, RuntimeConfig } from '../types/gateway';

export type DemoMode = 'live' | 'sample';
export interface WorkspaceOutletContext { setIsMobileOpen: (open: boolean) => void; gatewayOnline: boolean | null; }
export interface Presentation {
  step: number;
  nonce: string;
  prompt: string;
  cachePrompt: string;
  cacheBase?: string;
  compression?: CompressionResponse;
  cache: Array<{ label: string; result: LiveRequestResult }>;
  routing?: LiveRequestResult;
  tournament?: LiveRequestResult;
  rates: RateObservation[];
}
export const compressionPrompt = 'Could you please explain semantic caching for a technical audience. Explain semantic caching for a technical audience. Include cosine similarity, an honest cache miss example, and a short implementation checklist. Thank you.';
export const newPresentation = (): Presentation => ({ step: 0, nonce: Date.now().toString(36), prompt: compressionPrompt, cachePrompt: 'Explain how semantic caching reduces repeated provider calls in three sentences.', cache: [], rates: [] });
const readPresentation = (mode: DemoMode): Presentation => {
  try { return JSON.parse(sessionStorage.getItem('demo-results-' + mode) ?? 'null') ?? newPresentation(); } catch { return newPresentation(); }
};
interface WorkspaceState {
  gatewayKey: string;
  adminKey: string;
  online: boolean | null;
  ready: boolean | null;
  checking: boolean;
  config: RuntimeConfig | null;
  connectionError: ApiError | null;
  configError: ApiError | null;
  checkConnection: () => Promise<void>;
  mode: DemoMode;
  setMode: (mode: DemoMode) => void;
  presentation: Presentation;
  updatePresentation: (patch: Partial<Presentation> | ((state: Presentation) => Presentation)) => void;
  restart: () => void;
  demoKey: string;
  rateKey: string;
  saveDemoKeys: (normal?: string, rate?: string) => void;
}
const Context = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState(() => ({ gatewayKey: getGatewayApiKey() ?? '', adminKey: getAdminApiKey() ?? '' }));
  const [online, setOnline] = useState<boolean | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [connectionError, setConnectionError] = useState<ApiError | null>(null);
  const [configError, setConfigError] = useState<ApiError | null>(null);
  const [mode, setModeState] = useState<DemoMode>(() => sessionStorage.getItem('demo-mode') === 'sample' ? 'sample' : 'live');
  const [presentations, setPresentations] = useState(() => ({ live: readPresentation('live'), sample: readPresentation('sample') }));
  const [demoKey, setDemoKey] = useState(() => sessionStorage.getItem('demo-gateway-key') ?? '');
  const [rateKey, setRateKey] = useState(() => sessionStorage.getItem('demo-rate-key') ?? '');
  const checkSequence = useRef(0);
  const checkConnection = useCallback(async () => {
    const sequence = ++checkSequence.current;
    setChecking(true);
    const [readiness, runtime] = await Promise.allSettled([
      apiRequest<{ status: string }>('/ready', {}, 'none'), getRuntimeConfig(),
    ]);
    if (sequence !== checkSequence.current) return;
    if (readiness.status === 'fulfilled') { setOnline(true); setReady(readiness.value.status === 'ready'); setConnectionError(null); }
    else { setOnline(readiness.reason.status !== 0); setReady(false); setConnectionError(readiness.reason); }
    if (runtime.status === 'fulfilled') { setConfig(runtime.value); setConfigError(null); }
    else { setConfig(null); setConfigError(runtime.reason); }
    setChecking(false);
  }, []);
  useEffect(() => {
    const changed = () => {
      setCredentials({ gatewayKey: getGatewayApiKey() ?? '', adminKey: getAdminApiKey() ?? '' });
      setConfig(null);
      void checkConnection();
    };
    const poll = () => { if (document.visibilityState === 'visible') void checkConnection(); };
    void checkConnection();
    window.addEventListener(CREDENTIAL_EVENT, changed);
    window.addEventListener('storage', changed);
    const interval = window.setInterval(poll, 30000);
    return () => { ++checkSequence.current; window.removeEventListener(CREDENTIAL_EVENT, changed); window.removeEventListener('storage', changed); window.clearInterval(interval); };
  }, [checkConnection]);
  useEffect(() => { sessionStorage.setItem('demo-results-live', JSON.stringify(presentations.live)); sessionStorage.setItem('demo-results-sample', JSON.stringify(presentations.sample)); }, [presentations]);
  const setMode = (value: DemoMode) => { sessionStorage.setItem('demo-mode', value); setModeState(value); };
  const updatePresentation: WorkspaceState['updatePresentation'] = patch => setPresentations(current => ({ ...current, [mode]: typeof patch === 'function' ? patch(current[mode]) : { ...current[mode], ...patch } }));
  const saveDemoKeys = (normal?: string, rate?: string) => {
    if (normal !== undefined) { sessionStorage.setItem('demo-gateway-key', normal); setDemoKey(normal); }
    if (rate !== undefined) { sessionStorage.setItem('demo-rate-key', rate); setRateKey(rate); }
  };
  return <Context.Provider value={{ ...credentials, online, ready, checking, config, connectionError, configError, checkConnection, mode, setMode, presentation: presentations[mode], updatePresentation, restart: () => updatePresentation(newPresentation()), demoKey, rateKey, saveDemoKeys }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('WorkspaceProvider is missing'); return value; }

// Only mounted monitoring pages poll, and background tabs remain quiet.
export function useLiveRefresh(load: () => void) {
  const { adminKey } = useWorkspace();
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') latest.current(); };
    latest.current();
    window.addEventListener(TELEMETRY_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(refresh, 15000);
    return () => { window.removeEventListener(TELEMETRY_EVENT, refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(interval); };
  }, [adminKey]);
}
export function useTelemetry() {
  const [data, setData] = useState<BackendUsageResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const { adminKey } = useWorkspace();
  useEffect(() => { setData(null); setError(null); return () => { ++generation.current; }; }, [adminKey]);
  useLiveRefresh(() => {
    const request = ++generation.current;
    setLoading(true);
    getUsageSnapshot().then(value => { if (request === generation.current) { setData(value); setError(null); } }).catch(reason => { if (request === generation.current) { setData(null); setError(reason); } }).finally(() => { if (request === generation.current) setLoading(false); });
  });
  return { data, error, loading };
}
