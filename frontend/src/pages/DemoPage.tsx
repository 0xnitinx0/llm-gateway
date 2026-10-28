import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ConnectionPanel } from '../components/features/ConnectionPanel';
import { Feature, FeatureConsole, ResultEvidence } from '../components/features/FeatureConsole';
import { useWorkspace } from '../state/WorkspaceSession';
const steps = [
  { title: 'Prepare', time: '45 sec', takeaway: 'One workspace for gateway access, configuration, and evidence.' },
  { title: 'Compression', time: '60 sec', takeaway: 'Inspect exactly what the compressor removes before forwarding.' },
  { title: 'Semantic cache', time: '60 sec', takeaway: 'An exact repeat can avoid inference. Similarity alone does not guarantee a hit.' },
  { title: 'Routing & streaming', time: '75 sec', takeaway: 'Classification drives provider preference. A cache hit skips routing.' },
  { title: 'Tournament', time: '75 sec', takeaway: 'Compare real candidate answers and inspect the judge’s decision.' },
  { title: 'Rate limit & recap', time: '60 sec', takeaway: 'An independent bucket protects gateway capacity. Retry after refill.' },
];
const features: Feature[] = ['compression', 'cache', 'chat', 'tournament', 'rate'];
export function DemoPage() {
  const session = useWorkspace();
  const { setIsMobileOpen } = useOutletContext<{ setIsMobileOpen: (open: boolean) => void }>();
  const [busy, setBusy] = useState(false);
  const step = Math.max(0, Math.min(5, session.presentation.step));
  const state = session.presentation;
  const evidence = step === 2 ? state.cache[state.cache.length - 1]?.result : step === 3 ? state.routing : step === 4 ? state.tournament : undefined;
  return <div className="space-y-6">
    <PageHeader title="Guided gateway demo" description="A 5–7 minute technical walkthrough. You control every request." gatewayOnline={session.online} onOpenMobileSidebar={() => setIsMobileOpen(true)} actions={<Badge variant={session.mode === 'sample' ? 'demo' : 'live'}>{session.mode === 'sample' ? 'Sample demo' : 'Live session'}</Badge>} />
    <div className="workspace-content space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border rounded-lg bg-surface p-3"><div className="flex gap-2"><Button size="sm" variant={session.mode === 'live' ? 'primary' : 'secondary'} disabled={busy} onClick={() => session.setMode('live')}>Use live results</Button><Button size="sm" variant={session.mode === 'sample' ? 'primary' : 'secondary'} disabled={busy} onClick={() => session.setMode('sample')}>Use sample walkthrough</Button></div><Button size="sm" variant="ghost" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} disabled={busy} onClick={session.restart}>Restart walkthrough</Button></div>
      {session.mode === 'sample' && <p className="sample-notice" role="status"><strong>Sample demo.</strong> Illustrative fixtures only. Feature actions make no backend requests; scores, timings, and token counts are examples.</p>}
      <div className="demo-grid">
        <nav aria-label="Demo steps" className="demo-steps"><p className="eyebrow mb-3">Presentation sequence</p><ol className="space-y-1">{steps.map((item, index) => <li key={item.title}><button disabled={busy} aria-current={step === index ? 'step' : undefined} onClick={() => session.updatePresentation({ step: index })} className={`w-full text-left flex items-start gap-3 rounded-lg px-3 py-3 border ${step === index ? 'bg-surface border-accent-300 text-accent-800' : 'border-transparent text-earth-600 hover:bg-surface/60'} disabled:opacity-50`}><span className="font-mono text-xs pt-0.5">0{index + 1}</span><span className="text-sm font-semibold">{item.title}<small className="block mt-1 text-earth-500 font-normal">{item.time}</small></span></button></li>)}</ol><p className="text-xs text-earth-500 mt-5 leading-5">Results stay with this browser session. Restart resets presentation results; shared cache and usage history remain.</p></nav>
        <div className="min-w-0 space-y-5"><div><p className="eyebrow">Step {step + 1} of 6 · {steps[step].time}</p><h2 className="text-2xl font-semibold mt-2 text-earth-900">{steps[step].title}</h2></div>
          {step === 0 ? session.mode === 'live' ? <ConnectionPanel prepare /> : <Card title="Sample session ready" subtitle="No credentials or providers required"><p className="text-sm leading-6">Use this walkthrough when the backend is offline or provider access is unavailable. All results are illustrative. The cache paraphrase example deliberately misses, and the tournament includes a failed candidate.</p><p className="text-sm mt-3">Advance when ready; feature actions run only when you click them.</p></Card> : <FeatureConsole key={`${session.mode}-${step}`} feature={features[step - 1]} guided onBusy={setBusy} />}
          {step === 5 && <Card title="Session recap" subtitle={session.mode === 'live' ? 'Observed results in this walkthrough' : 'Illustrative sample results'}><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-earth-500">Compression reduction</dt><dd className="text-xl font-semibold">{state.compression ? state.compression.metrics.reduction_percent + '%' : '—'}</dd></div><div><dt className="text-earth-500">Cache calls avoided</dt><dd className="text-xl font-semibold">{state.cache.length ? state.cache.filter(item => item.result.cache_hit).length : '—'}</dd></div><div><dt className="text-earth-500">Selected route</dt><dd>{state.routing ? `${state.routing.provider} / ${state.routing.model}` : '—'}</dd></div><div><dt className="text-earth-500">Tournament winner</dt><dd>{state.tournament?.winning_model ?? '—'}</dd></div><div><dt className="text-earth-500">Rate-limit responses</dt><dd>{state.rates.length ? state.rates.filter(item => item.status === 429).length + ' observed 429s' : '—'}</dd></div></dl><div className="flex flex-wrap gap-4 mt-5 text-sm underline"><Link to="/usage">Usage & savings</Link><Link to="/cache">Cache activity</Link><Link to="/api-keys">Manage demo keys</Link></div></Card>}
          <div className="flex justify-between border-t pt-4"><Button variant="secondary" size="sm" disabled={busy || step === 0} onClick={() => session.updatePresentation({ step: step - 1 })} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>Previous</Button>{step < 5 ? <Button size="sm" disabled={busy} onClick={() => session.updatePresentation({ step: step + 1 })} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>Next: {steps[step + 1].title}</Button> : <Link to="/dashboard"><Button size="sm">Return to workspace</Button></Link>}</div>
        </div>
        <aside className="demo-evidence space-y-4" aria-label="Evidence panel"><Card title="How it works"><p className="text-sm leading-6">{steps[step].takeaway}</p></Card><Card title="Evidence" subtitle={session.mode === 'live' ? 'Returned by the gateway' : 'Illustrative sample'}>{step === 1 && state.compression ? <dl className="text-xs space-y-3"><div><dt>Strategy</dt><dd className="font-semibold">{state.compression.metrics.strategy}</dd></div><div><dt>Tokens removed</dt><dd>{state.compression.metrics.tokens_saved}</dd></div><div><dt>Provider calls</dt><dd>None · preview only</dd></div></dl> : step === 5 && state.rates.length ? <p className="text-xs leading-6">{state.rates.length} preview responses recorded. Remaining capacity and Retry-After come from each response’s headers.</p> : <ResultEvidence result={evidence} />}</Card></aside>
      </div>
    </div>
  </div>;
}
