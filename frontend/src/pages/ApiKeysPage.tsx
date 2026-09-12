import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CopyButton } from '../components/common/CopyButton';
import { ApiKeyItem } from '../types/gateway';
import { getApiKeys, createApiKey, revokeApiKey } from '../services/gateway';
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const ApiKeysPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApiKeys();
      setKeys(data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'detail' in err 
        ? String((err as { detail: unknown }).detail) 
        : 'Unable to load API keys.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createApiKey(newKeyName.trim());
      setKeys([res.key, ...keys]);
      setCreatedSecret(res.secretKey);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gateway_api_key', res.secretKey);
      }

    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'detail' in err 
        ? String((err as { detail: unknown }).detail) 
        : 'Failed to create API key.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;

    setIsRevoking(true);
    try {
      await revokeApiKey(revokeTarget.id);
      setKeys(
        keys.map((k) => (k.id === revokeTarget.id ? { ...k, status: 'revoked' } : k))
      );
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'detail' in err 
        ? String((err as { detail: unknown }).detail) 
        : 'Failed to revoke API key.';
      alert(msg);
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
  };

  const resetCreateModal = () => {
    setIsCreateOpen(false);
    setNewKeyName('');
    setCreatedSecret(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage access to your Gateway. Distribute unique keys to internal microservices and teams."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={gatewayOnline}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create API Key
          </Button>
        }
      />

      <div className="px-4 sm:px-8 max-w-6xl mx-auto space-y-6">
        {/* API Keys Table Card */}
        <Card
          title="Gateway API Keys"
          subtitle="Client credentials authorized to call /v1/chat/completions"
          noPadding
        >
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading API keys...</div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-red-600">{error}</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No portal API keys created yet. Click &quot;Create API Key&quot; above to generate one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Name</th>
                    <th className="py-3 px-5">Key Token</th>
                    <th className="py-3 px-5">Created</th>
                    <th className="py-3 px-5">Last Used</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                  {keys.map((key) => (
                    <tr key={key.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{key.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                          {key.maskedKey}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">{key.createdAt}</td>
                      <td className="py-3.5 px-5 text-slate-500">{key.lastUsed}</td>
                      <td className="py-3.5 px-5">
                        <Badge variant={key.status === 'active' ? 'success' : 'neutral'}>
                          {key.status === 'active' ? 'Active' : 'Revoked'}
                        </Badge>

                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {key.status === 'active' ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setRevokeTarget(key)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Security Assurance Notice */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 flex items-start gap-3.5 shadow-2xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <h4 className="font-semibold text-slate-900">Zero Provider Key Exposure & Safe Storage</h4>
            <p className="leading-relaxed">
              Your developers and frontends never touch Gemini or OpenAI tokens. Gateway API keys are stored securely using SHA-256 key hashing in PostgreSQL. Raw generated keys are displayed only once upon creation and are never persisted.
            </p>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={resetCreateModal}
        title={createdSecret ? 'API Key Created' : 'Create Gateway API Key'}
        subtitle={
          createdSecret
            ? 'Make sure to copy your API key now as you will not be able to see it again.'
            : 'Enter a recognizable identifier for this client credential.'
        }
      >
        {!createdSecret ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="key-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Key Name
              </label>
              <input
                id="key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production Microservice, Staging Web App"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={resetCreateModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={!newKeyName.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Key'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Key successfully created and authorized.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">API Key</label>
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                <code className="flex-1 font-mono text-xs text-slate-900 break-all select-all">
                  {createdSecret}
                </code>
                <CopyButton textToCopy={createdSecret} />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="sm" onClick={resetCreateModal}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke API Key"
        subtitle="This action is permanent and cannot be undone."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p>
              Are you sure you want to revoke <strong>{revokeTarget?.name}</strong>? Any application utilizing this credential will immediately receive 401 Unauthorized responses.
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
