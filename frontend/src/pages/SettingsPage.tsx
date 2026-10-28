import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { ConnectionPanel } from '../components/features/ConnectionPanel';
import { useWorkspace } from '../state/WorkspaceSession';

export function SettingsPage() {
  const { setIsMobileOpen } = useOutletContext<{ setIsMobileOpen: (open: boolean) => void }>();
  const session = useWorkspace();
  const config = session.config;
  return <div className="space-y-6"><PageHeader title="Settings" description="Shared connection credentials and read-only runtime configuration." gatewayOnline={session.online} onOpenMobileSidebar={() => setIsMobileOpen(true)} />
    <div className="workspace-content space-y-5"><ConnectionPanel />
      <Card title="Runtime configuration" subtitle="Environment-controlled and read-only">
        {config ? <dl className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 text-sm">{[['Cache threshold', config.cache_similarity_threshold], ['Embedding model', config.embedding_model], ['Embedding dimensions', config.embedding_dimensions], ['Compression target', Math.round(config.compression_target_ratio * 100) + '%'], ['Enabled providers', config.enabled_providers.join(', ')], ['Judge provider', config.judge_provider]].map(([label, value]) => <div key={label}><dt className="text-earth-500 text-xs">{label}</dt><dd className="font-mono font-semibold mt-1 break-words">{value}</dd></div>)}</dl> : <p className="text-sm text-earth-500">Save a valid admin key to load the live configuration.</p>}
      </Card>
      <Card title="Provider configuration" subtitle="Availability indicates configuration, not verified credit or inference">
        {config?.provider_availability?.length ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{config.provider_availability.map(provider => <div key={provider.name} className="border p-4 rounded-lg"><p className="font-semibold text-sm">{provider.name}</p><p className="text-xs text-earth-500 mt-1 break-words">{provider.model}</p><p className="text-xs mt-3">{provider.available ? provider.kind === 'local' ? 'Available · simulated inference' : 'Configured' : 'Unavailable'}</p></div>)}</div> : <p className="text-sm text-earth-500">Provider availability is unavailable.</p>}
        <p className="text-sm mt-4">Tournament: {config?.tournament_readiness?.ready ? 'Configured · ' + config.tournament_readiness.candidates.join(', ') : config?.tournament_readiness?.reason ?? 'Readiness unavailable'}</p>
      </Card>
      <Card title="Credential storage"><p className="text-sm leading-6 text-earth-600">Admin credentials and dedicated demo secrets stay in browser session storage. Your selected gateway key is saved locally for the Playground. Provider credentials stay on the backend. Revoke dedicated session keys in API Keys after presenting.</p></Card>
    </div>
  </div>;
}
