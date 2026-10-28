import { Link, useOutletContext } from 'react-router-dom';
import { Activity, ArrowRight, Minimize2, Play, Zap } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConnectionPanel } from '../components/features/ConnectionPanel';
import { RequestOverviewChart } from '../components/charts/RequestOverviewChart';
import { mapActivity, mapDashboard } from '../services/metrics';
import { useTelemetry, useWorkspace } from '../state/WorkspaceSession';
const workflow = [
  ['01', 'Authenticate', 'Gateway key and independent rate bucket'],
  ['02', 'Check cache', 'Compare embeddings against stored answers'],
  ['03', 'Compress', 'Reduce the forwarded prompt on a miss'],
  ['04', 'Route', 'Classify the request and select a provider'],
  ['05', 'Respond', 'Stream output and record usage evidence'],
];
const shortcuts = [
  { title: 'Prompt compression', text: 'Compare original and compressed text, with exact token reductions.', mode: 'compression' },
  { title: 'Semantic cache', text: 'Inspect hits, misses, similarity, and provider calls avoided.', to: '/cache' },
  { title: 'Routing & streaming', text: 'Send simple, coding, or reasoning prompts and inspect actual routing.', mode: 'chat' },
  { title: 'Response tournaments', text: 'Compare cloud candidates and follow the judge’s decision.', mode: 'tournament' },
];
export function DashboardPage() {
  const { setIsMobileOpen } = useOutletContext<{ setIsMobileOpen: (open: boolean) => void }>();
  const session = useWorkspace();
  const { data, error, loading } = useTelemetry();
  const metrics = data ? mapDashboard(data) : null;
  const activity = data ? mapActivity(data) : [];
  return <div className="space-y-6">
    <PageHeader title="Gateway workspace" description="One endpoint. Observable routing, prompt efficiency, and semantic reuse." onOpenMobileSidebar={() => setIsMobileOpen(true)} gatewayOnline={session.online} actions={<Link to="/demo"><Button size="sm" leftIcon={<Play className="w-3.5 h-3.5" />}>Start demo</Button></Link>} />
    <div className="workspace-content space-y-6">
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-4">
        {[{ label: 'Total requests', value: metrics?.totalRequests.toLocaleString(), note: 'Persisted gateway events', icon: Activity }, { label: 'Cache hit rate', value: metrics ? metrics.cacheHitRate + '%' : null, note: 'Successful chat lookups', icon: Zap }, { label: 'Tokens saved', value: metrics?.tokensSaved.toLocaleString(), note: 'Forwarded prompt compression', icon: Minimize2 }, { label: 'Calls avoided', value: metrics?.callsAvoided.toLocaleString(), note: 'Observed semantic cache hits', icon: Zap }].map(item => <MetricCard key={item.label} label={item.label} value={item.value ?? '—'} sublabel={item.note} badgeVariant={data ? 'live' : 'neutral'} badgeText={data ? 'Live' : loading ? 'Loading' : 'Unavailable'} icon={<item.icon className="w-4 h-4" />} />)}
      </div>
      {error && <div className="border rounded-lg bg-surface p-4 space-y-3"><div className="flex flex-wrap justify-between gap-3"><p role="status" className="text-sm text-earth-600">{session.online === false || error.status === 0 ? 'The backend is offline. Connect it to display live metrics.' : error.status === 401 ? 'Admin access is required to display live metrics.' : error.detail}</p><Link to="/settings" className="text-xs underline">Open settings</Link></div><details><summary className="text-xs font-semibold cursor-pointer">Connection & setup</summary><div className="mt-3"><ConnectionPanel /></div></details></div>}
      <Card title="The gateway request path" subtitle="A cache hit reuses the stored answer; a miss proceeds through compression and routing." headerAction={<Badge variant="neutral">Architecture</Badge>}>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">{workflow.map(([number, title, text], index) => <div key={title} className="p-4 border rounded-lg bg-earth-50 relative"><div className="flex justify-between items-center"><span className="eyebrow">{number}</span>{index < 4 && <ArrowRight className="w-4 h-4 text-earth-400" aria-hidden="true" />}</div><h3 className="text-base font-semibold mt-4 text-earth-900">{title}</h3><p className="text-xs leading-5 mt-2 text-earth-500">{text}</p></div>)}</div>
        <div className="border rounded-lg bg-emerald-50/60 border-emerald-200 p-3 mt-3 text-xs text-emerald-800">Cache hit → reuse the stored answer → respond directly. Compression and routing are skipped.</div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 border-t pt-4"><p className="text-sm text-earth-600">Follow the complete path in a guided 5–7 minute technical demo.</p><Link to="/demo"><Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>Open walkthrough</Button></Link></div>
      </Card>
      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
        <Card title="Request overview" subtitle={data ? 'Persisted events over the last seven days' : 'Live history appears when telemetry is connected'}>{data ? <RequestOverviewChart data={data.history} /> : <div className="min-h-48 flex items-center justify-center text-sm text-earth-500">{loading ? 'Loading live history…' : 'History unavailable'}</div>}</Card>
        <Card title="Recent cache activity" subtitle="Prompt-free evidence from successful chat requests" noPadding><div className="overflow-x-auto"><table className="text-left text-xs w-full"><thead className="bg-earth-50"><tr><th className="p-4">Time / request</th><th>Outcome</th><th>Similarity</th><th className="pr-4">Latency</th></tr></thead><tbody>{activity.slice(0, 6).map(item => <tr key={item.id} className="border-t"><td className="p-4"><span>{item.time}</span><span className="block font-mono text-earth-500 mt-1" title={item.id}>{item.id.slice(0, 14)}…</span></td><td><Badge variant={item.result === 'HIT' ? 'hit' : 'miss'}>{item.result}</Badge></td><td>{item.similarity?.toFixed(4) ?? '—'}</td><td className="pr-4">{item.latency}</td></tr>)}</tbody></table></div>{!activity.length && <p className="p-6 text-sm text-earth-500">{loading ? 'Loading activity…' : data ? 'No requests recorded yet. Start in the Playground or guided demo.' : 'Activity unavailable until telemetry is connected.'}</p>}</Card>
      </div>
      <div><p className="eyebrow mb-3">Explore gateway capabilities</p><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{shortcuts.map(item => <Link key={item.title} to={item.to ?? '/playground?mode=' + item.mode} className="gateway-card p-5 hover:border-earth-400 transition-colors"><h3 className="font-semibold text-sm flex justify-between">{item.title}<ArrowRight className="w-4 h-4 text-earth-500" /></h3><p className="text-xs leading-5 text-earth-500 mt-3">{item.text}</p></Link>)}</div></div>
    </div>
  </div>;
}
