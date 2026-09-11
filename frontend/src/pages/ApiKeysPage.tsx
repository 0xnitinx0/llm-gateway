import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CopyButton } from '../components/common/CopyButton';
import { INITIAL_MOCK_API_KEYS } from '../../src/services/mockData';
import { ApiKeyItem } from '../types/gateway';
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const ApiKeysPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [keys, setKeys] = useState<ApiKeyItem[]>(INITIAL_MOCK_API_KEYS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const fullKey = `gw_live_${randomSuffix}`;
    const masked = `gw_live_${randomSuffix.substring(0, 4)}••••••••••••${randomSuffix.substring(randomSuffix.length - 4)}`;

    const newKeyItem: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      maskedKey: masked,
      createdAt: 'Just now',
      lastUsed: 'Never',
      status: 'active',
    };

    setKeys([newKeyItem, ...keys]);
    setCreatedSecret(fullKey);
  };

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    setKeys(keys.filter((k) => k.id !== revokeTarget.id));
    setRevokeTarget(null);
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
        {/* Transparent Disclaimer */}
        <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Gateway Key Management Simulation</p>
            <p className="leading-relaxed text-amber-800">
              The keys created on this page manage client-side mock keys for multi-tenant simulation. The live FastAPI gateway currently authenticates requests using the single server secret configured in <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">GATEWAY_API_KEY</code> (default: <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">gateway-secret-key</code>).
            </p>
          </div>
        </div>

        {/* API Keys Table Card */}
        <Card
          title="Active Gateway Keys"
          subtitle="Client credentials authorized to call /v1/chat/completions"
          headerAction={<Badge variant="demo">Demo State</Badge>}
          noPadding
        >
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
                      <Badge variant="success">Active</Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRevokeTarget(key)}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Security Assurance Notice */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 flex items-start gap-3.5 shadow-2xs">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <h4 className="font-semibold text-slate-900">Zero Provider Key Exposure</h4>
            <p className="leading-relaxed">
              Your developers and frontends never touch Gemini or OpenAI tokens. Gateway API keys provide an impenetrable perimeter between your client applications and upstream AI vendors.
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
                disabled={!newKeyName.trim()}
              >
                Create Key
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
            >
              Confirm Revoke
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
