import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../state/WorkspaceSession';
import { setAdminApiKey, setGatewayApiKey } from '../../services/api';
import { createApiKey } from '../../services/gateway';
import { previewCompression } from '../../services/features';
import { ApiError } from '../../types/gateway';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ConnectionPanel({ prepare = false }: { prepare?: boolean }) {
  const session = useWorkspace();
  const [admin, setAdmin] = useState(session.adminKey);
  const [gateway, setGateway] = useState(session.gatewayKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [verifiedKey, setVerifiedKey] = useState('');
  useEffect(() => { setAdmin(session.adminKey); setGateway(session.gatewayKey); }, [session.adminKey, session.gatewayKey]);
  const prepareKeys = async () => {
    setBusy(true); setError(null);
    try {
      if (!session.demoKey) { const normal = await createApiKey('Guided demo session', 120, 2); session.saveDemoKeys(normal.secretKey); }
      if (!session.rateKey) { const rate = await createApiKey('Guided demo · capacity 3', 3, 0.2); session.saveDemoKeys(undefined, rate.secretKey); }
    } catch (reason) { setError(reason as ApiError); }
    finally { setBusy(false); }
  };
  const verifyKey = async () => {
    setBusy(true); setError(null);
    try { const key = session.demoKey || session.gatewayKey; await previewCompression('Verify gateway access.', key); setVerifiedKey(key); }
    catch (reason) { setError(reason as ApiError); }
    finally { setBusy(false); }
  };
  const effectiveKey = session.demoKey || session.gatewayKey;
  return <Card title={prepare ? 'Prepare your live session' : 'Connection & access'} subtitle="Check readiness and save credentials before sending a request.">
    <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm"><div className="border rounded-lg p-3"><p className="text-earth-500 text-xs">Backend readiness</p><strong>{session.checking ? 'Checking…' : session.ready ? 'Ready' : session.online === false ? 'Offline' : session.ready === false ? 'Not ready' : 'Not checked'}</strong>{session.connectionError && <p className="text-xs text-red-700 mt-1">{session.connectionError.detail}</p>}</div><div className="border rounded-lg p-3"><p className="text-earth-500 text-xs">Admin access</p><strong>{session.config ? 'Verified' : session.configError?.status === 401 ? 'Authentication required' : 'Unavailable'}</strong>{session.configError && <p className="text-xs text-earth-500 mt-1">{session.configError.detail}</p>}</div></div>
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-semibold">Admin key<input aria-label="Admin key" type="password" autoComplete="off" value={admin} onChange={e => setAdmin(e.target.value)} className="block w-full border px-3 py-2 mt-1" placeholder="For configuration and key creation" /></label><label className="text-xs font-semibold">Gateway key<input aria-label="Gateway key" type="password" autoComplete="off" value={gateway} onChange={e => setGateway(e.target.value)} className="block w-full border px-3 py-2 mt-1" placeholder="For live feature requests" /></label></div>
    <div className="flex flex-wrap gap-2 mt-4"><Button size="sm" onClick={() => { setAdminApiKey(admin); setGatewayApiKey(gateway); }}>Save credentials</Button><Button size="sm" variant="secondary" onClick={() => void session.checkConnection()} isLoading={session.checking}>Check readiness</Button><Link to="/settings" className="text-xs underline self-center">Setup details</Link></div>
    {prepare && <div className="mt-5 border-t pt-4 space-y-3"><p className="text-sm">Gateway credentials: {effectiveKey ? verifiedKey === effectiveKey ? 'verified by compression preview' : session.demoKey ? 'dedicated session key created' : 'present; verify access below' : 'missing'}. Demo secrets stay in browser session storage.</p><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!session.config || !session.ready || busy || Boolean(session.demoKey && session.rateKey)} onClick={prepareKeys}>{busy ? 'Preparing…' : session.demoKey && session.rateKey ? 'Live session prepared' : 'Prepare live session'}</Button><Button size="sm" variant="secondary" disabled={!effectiveKey || !session.ready || busy} onClick={verifyKey}>Verify gateway key</Button></div><p className="text-xs text-earth-500">Preparation creates two dedicated keys: a normal session key and a capacity-3 bucket refilling at 0.2 tokens/second. Existing session keys are reused.</p></div>}
    {prepare && <div className="mt-5 border-t pt-4 space-y-2"><p className="text-sm font-semibold">Configured providers</p>{session.config?.provider_availability?.map(provider => <p className="text-xs" key={provider.name}>{provider.name} / {provider.model} · {provider.available ? provider.kind === 'local' ? 'Available · simulated inference' : 'Configured' : 'Unavailable'}</p>)}{!session.config && <p className="text-xs text-earth-500">Admin access is required to inspect provider configuration.</p>}<p className="text-xs">Tournament: {session.config?.tournament_readiness?.ready ? 'Configured for candidates ' + session.config.tournament_readiness.candidates.join(', ') : session.config?.tournament_readiness?.reason ?? 'Readiness unavailable'}</p><p className="text-xs text-earth-500">Configuration does not verify provider credit or successful inference. No provider call happens during preparation.</p></div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error.detail}</p>}
  </Card>;
}
