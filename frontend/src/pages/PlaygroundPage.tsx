import { useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { ConnectionPanel } from '../components/features/ConnectionPanel';
import { Feature, FeatureConsole } from '../components/features/FeatureConsole';
import { useWorkspace } from '../state/WorkspaceSession';
const modes: Array<{ label: string; feature: Feature }> = [{ label: 'Chat', feature: 'chat' }, { label: 'Compression', feature: 'compression' }, { label: 'Tournament', feature: 'tournament' }, { label: 'Rate Limit', feature: 'rate' }];
export function PlaygroundPage() {
  const session = useWorkspace();
  const { setIsMobileOpen } = useOutletContext<{ setIsMobileOpen: (open: boolean) => void }>();
  const [params, setParams] = useSearchParams();
  const feature = modes.find(item => item.feature === params.get('mode'))?.feature ?? 'chat';
  const [busy, setBusy] = useState(false);
  return <div className="space-y-6"><PageHeader title="Playground" description="Explore each gateway capability and inspect its evidence." gatewayOnline={session.online} onOpenMobileSidebar={() => setIsMobileOpen(true)} actions={<Link to="/demo"><Button size="sm">Start demo</Button></Link>} />
    <div className="workspace-content space-y-5">{session.mode === 'sample' && <p className="sample-notice"><strong>Sample demo.</strong> Actions use illustrative fixtures. <button disabled={busy} onClick={() => session.setMode('live')} className="underline font-semibold">Switch to live</button></p>}
      <div className="flex gap-2 flex-wrap" aria-label="Playground modes">{modes.map(item => <Button key={item.feature} size="sm" variant={feature === item.feature ? 'primary' : 'secondary'} disabled={busy} aria-pressed={feature === item.feature} onClick={() => setParams({ mode: item.feature })}>{item.label}</Button>)}</div>
      {session.mode === 'live' && <details className="border rounded-lg bg-surface p-4" open={!session.gatewayKey && !session.demoKey || !session.ready}><summary className="text-sm font-semibold cursor-pointer">Connection & credentials</summary><div className="mt-4"><ConnectionPanel prepare={feature === 'rate'} /></div></details>}
      <FeatureConsole key={`${session.mode}-${feature}`} feature={feature} onBusy={setBusy} />
    </div></div>;
}
