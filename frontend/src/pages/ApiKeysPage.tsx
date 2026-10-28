import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, KeyRound, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CopyButton } from '../components/common/CopyButton';
import { AdminNotice } from '../components/common/AdminNotice';
import { ApiError, ApiKeyItem } from '../types/gateway';
import { createApiKey, getApiKeys, revokeApiKey } from '../services/gateway';
import { setGatewayApiKey } from '../services/api';
import { useLiveRefresh, useWorkspace, WorkspaceOutletContext } from '../state/WorkspaceSession';

export const ApiKeysPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<WorkspaceOutletContext>();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(60);
  const [refill, setRefill] = useState(1);
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [busy, setBusy] = useState(false);
  const { adminKey } = useWorkspace();
  const loadGeneration = useRef(0);
  useEffect(() => { setKeys([]); setError(null); setLoading(true); return () => { ++loadGeneration.current; }; }, [adminKey]);
  useLiveRefresh(() => {
    const generation = ++loadGeneration.current;
    getApiKeys().then(value => { if (generation === loadGeneration.current) { setKeys(value); setError(null); } })
      .catch(err => { if (generation === loadGeneration.current) { setKeys([]); setError(err); } })
      .finally(() => { if (generation === loadGeneration.current) setLoading(false); });
  });
  const create = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { const result = await createApiKey(name.trim(), capacity, refill); setKeys(current => [result.key, ...current]); setSecret(result.secretKey); setGatewayApiKey(result.secretKey); } catch (err: unknown) { setError(err as ApiError); setOpen(false); } finally { setBusy(false); } };
  const revoke = async () => { if (!revokeTarget) return; setBusy(true); try { await revokeApiKey(revokeTarget.id); setKeys(current => current.map(key => key.id === revokeTarget.id ? { ...key, status: 'revoked' } : key)); } catch (err: unknown) { setError(err as ApiError); } finally { setBusy(false); setRevokeTarget(null); } };
  const close = () => { setOpen(false); setName(''); setSecret(null); setCapacity(60); setRefill(1); };
  return <div className="space-y-6">
    <PageHeader title="API Keys" description="Create and revoke PostgreSQL-backed gateway credentials." onOpenMobileSidebar={() => setIsMobileOpen(true)} gatewayOnline={gatewayOnline} actions={<Button variant="primary" size="sm" onClick={() => setOpen(true)} leftIcon={<Plus className="w-4 h-4"/>}>Create API Key</Button>} />
    <div className="workspace-content">
      {error ? <AdminNotice message={error.detail} status={error.status} /> : <Card title="Gateway API Keys" subtitle="Raw secrets are returned only once" noPadding>
        {loading ? <p className="p-8 text-sm text-earth-500">Loading keys...</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-earth-50 border-b"><tr><th className="p-4">Name</th><th>Key</th><th>Rate bucket</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>{keys.map(key => <tr key={key.id} className="border-b"><td className="p-4 font-semibold"><KeyRound className="inline w-3.5 h-3.5 mr-2 text-accent-600"/>{key.name}</td><td className="font-mono">{key.maskedKey}</td><td>{key.rateLimitCapacity} capacity · {key.refillRatePerSecond} tokens/s</td><td>{key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}</td><td><Badge variant={key.status === 'active' ? 'success' : 'neutral'}>{key.status}</Badge></td><td className="pr-4 text-right">{key.status === 'active' && <Button variant="danger" size="sm" onClick={() => setRevokeTarget(key)} leftIcon={<Trash2 className="w-3 h-3"/>}>Revoke</Button>}</td></tr>)}</tbody></table>{!keys.length && <p className="p-8 text-center text-earth-500">No keys found.</p>}</div>}
      </Card>}
    </div>
    <Modal isOpen={open} onClose={close} title={secret ? 'API Key Created' : 'Create Gateway API Key'} subtitle={secret ? 'Copy this secret now; only its hash is stored.' : 'Set an independent Redis token-bucket policy.'}>
      {secret ? <div className="space-y-4"><p className="flex gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4"/>Key created and selected for the Playground.</p><div className="flex gap-2 p-3 bg-earth-50 border rounded"><code className="flex-1 break-all">{secret}</code><CopyButton textToCopy={secret}/></div><Button variant="primary" size="sm" onClick={close}>Done</Button></div> :
      <form onSubmit={create} className="space-y-4"><label className="block text-xs font-semibold">Name<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded text-sm" required /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Capacity<input type="number" min="1" value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded" /></label><label className="text-xs font-semibold">Refill / second<input type="number" min="0.01" step="0.01" value={refill} onChange={e => setRefill(Number(e.target.value))} className="mt-1 w-full px-3 py-2 border rounded" /></label></div><Button variant="primary" size="sm" type="submit" disabled={busy || !name.trim() || capacity < 1 || refill <= 0}>{busy ? 'Creating...' : 'Create Key'}</Button></form>}
    </Modal>
    <Modal isOpen={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} title="Revoke API Key" subtitle="Requests using this credential will immediately fail." maxWidth="sm"><p className="flex gap-2 text-sm text-red-700"><AlertTriangle className="w-4 h-4"/>Revoke {revokeTarget?.name}?</p><div className="flex justify-end mt-4"><Button variant="danger" size="sm" onClick={revoke} disabled={busy}>Confirm Revoke</Button></div></Modal>
  </div>;
};
