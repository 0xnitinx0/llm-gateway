import React from 'react';
import { useTelemetry, useWorkspace, WorkspaceOutletContext } from '../state/WorkspaceSession';
import { useOutletContext } from 'react-router-dom';
import { Database, Layers, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AdminNotice } from '../components/common/AdminNotice';
import { SimilarityBarChart } from '../components/charts/SimilarityBarChart';
import { mapActivity, mapCache } from '../services/metrics';

export const CachePage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<WorkspaceOutletContext>();
  const { data: usage, error } = useTelemetry();
  const { config } = useWorkspace();
  const cache = usage ? mapCache(usage) : null;
  const activity = usage ? mapActivity(usage) : [];
  return <div className="space-y-6">
    <PageHeader title="Semantic Cache" description="Live pgvector deduplication telemetry without prompt exposure." onOpenMobileSidebar={() => setIsMobileOpen(true)} gatewayOnline={gatewayOnline} />
    <div className="workspace-content space-y-6">
      {error ? <AdminNotice message={error.detail} status={error.status} /> : <>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Cache Hit Rate" value={cache ? cache.hitRate + '%' : '...'} sublabel={'Threshold >= ' + (config?.cache_similarity_threshold ?? '...')} badgeVariant="live" badgeText="Live" icon={<Zap className="w-4 h-4 text-emerald-500" />} />
          <MetricCard label="Cache Hits" value={cache ? cache.hits.toLocaleString() : '...'} sublabel="Provider calls avoided" badgeVariant="live" badgeText="Live" icon={<Database className="w-4 h-4 text-accent-500" />} />
          <MetricCard label="Cache Misses" value={cache ? cache.misses.toLocaleString() : '...'} sublabel="Forwarded requests" badgeVariant="live" badgeText="Live" icon={<Layers className="w-4 h-4 text-clay-500" />} />
          <MetricCard label="Active Entries" value={cache?.activeEntries?.toLocaleString() ?? '...'} sublabel="HNSW-indexed responses" badgeVariant="live" badgeText="Live" icon={<Sparkles className="w-4 h-4 text-ochre-500" />} />
        </div>
        <Card title="Similarity Distribution" subtitle="Cosine similarity scores from successful chat requests" headerAction={<Badge variant="live">Live Data</Badge>}><SimilarityBarChart data={usage?.similarity_distribution ?? []} /><p className="text-[11px] text-earth-500 mt-3">Model: {config?.embedding_model} ({config?.embedding_dimensions} dimensions)</p></Card>
        <Card title="Recent Cache Activity" subtitle="Request IDs, lookup outcomes, and latency; prompts are never returned">
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-earth-50"><tr><th className="p-3">Time</th><th>Request ID</th><th>Outcome</th><th>Similarity</th><th className="pr-3">Latency</th></tr></thead><tbody>{activity.map(item => <tr key={item.id} className="border-t"><td className="p-3">{item.time}</td><td className="font-mono" title={item.id}>{item.id.slice(0, 20)}…</td><td><Badge variant={item.result === 'HIT' ? 'hit' : 'miss'}>{item.result}</Badge></td><td>{item.similarity?.toFixed(4) ?? '—'}</td><td className="pr-3">{item.latency}</td></tr>)}</tbody></table>{!activity.length && <p className="p-4 text-sm text-earth-500">No cache activity recorded yet.</p>}</div>
        </Card>
      </>}
    </div>
  </div>;
};
