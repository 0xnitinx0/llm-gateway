import React from 'react';
import { useTelemetry, WorkspaceOutletContext } from '../state/WorkspaceSession';
import { useOutletContext } from 'react-router-dom';
import { Minimize2, ShieldCheck, Trophy } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AdminNotice } from '../components/common/AdminNotice';
import { TokenUsageComparisonChart } from '../components/charts/TokenUsageComparisonChart';
import { mapCompression, mapTournament, mapUsage } from '../services/metrics';

const formatUsd = (value: number): string => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 8,
}).format(value);

export const UsagePage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<WorkspaceOutletContext>();
  const { data, error } = useTelemetry();
  const usage = data ? mapUsage(data) : null;
  const compression = data ? mapCompression(data) : null;
  const tournament = data ? mapTournament(data) : null;
  const withoutCompression = usage ? usage.totalTokens + usage.tokensSaved : 0;
  const costs = data?.costs;
  const hasPricedRequests = Boolean(costs?.priced_requests);
  return <div className="space-y-6">
    <PageHeader title="Usage & Efficiency" description="Measured request, token, compression, and tournament behavior." onOpenMobileSidebar={() => setIsMobileOpen(true)} gatewayOnline={gatewayOnline} />
    <div className="workspace-content space-y-6">
      {error ? <AdminNotice message={error.detail} status={error.status} /> : <>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard label="Total Requests" value={usage ? usage.totalRequests.toLocaleString() : '...'} sublabel="Persisted events" badgeVariant="live" badgeText="Live" />
          <MetricCard label="Provider Calls" value={usage ? usage.llmCalls.toLocaleString() : '...'} sublabel="Logical model calls" badgeVariant="live" badgeText="Live" />
          <MetricCard label="Calls Avoided" value={usage ? usage.callsAvoided.toLocaleString() : '...'} sublabel="Semantic cache hits" badgeVariant="live" badgeText="Live" />
          <MetricCard label="Tokens Saved" value={usage ? usage.tokensSaved.toLocaleString() : '...'} sublabel="Prompt compression" badgeVariant="live" badgeText="Live" />
          <MetricCard label="Rate Limited" value={usage ? usage.rateLimitedRequests.toLocaleString() : '...'} sublabel="HTTP 429 responses" badgeVariant="live" badgeText="Live" />
        </div>
        <Card title="Estimated USD Savings" subtitle="Compared with one direct, uncompressed call to the response model" headerAction={<Badge variant="live">Configured rates</Badge>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded"><p className="text-xs text-emerald-700">Net saved{hasPricedRequests && costs!.net_savings_usd < 0 ? ' (extra spending)' : ''}</p><strong className="text-xl font-mono text-emerald-700">{hasPricedRequests ? formatUsd(Math.abs(costs!.net_savings_usd)) : '—'}</strong></div>
            <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Direct baseline</p><strong className="text-xl font-mono">{hasPricedRequests ? formatUsd(costs!.baseline_spend_usd) : '—'}</strong></div>
            <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Estimated actual</p><strong className="text-xl font-mono">{hasPricedRequests ? formatUsd(costs!.actual_spend_usd) : '—'}</strong></div>
            <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Cache saved</p><strong className="text-lg font-mono">{hasPricedRequests ? formatUsd(costs!.cache_savings_usd) : '—'}</strong></div>
            <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Compression saved</p><strong className="text-lg font-mono">{hasPricedRequests ? formatUsd(costs!.compression_savings_usd) : '—'}</strong></div>
            <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Tournament overhead</p><strong className="text-lg font-mono">{hasPricedRequests ? formatUsd(costs!.tournament_overhead_usd) : '—'}</strong></div>
          </div>
          <p className="mt-3 text-xs text-earth-600">{costs?.configured_models === 0 ? 'Rates not configured. Set MODEL_PRICING_JSON to calculate estimates.' : `${costs?.priced_requests ?? 0} priced requests; ${costs?.unpriced_requests ?? 0} unpriced requests. Historical requests without rates are not backfilled.`}</p>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Token Efficiency" subtitle="Recorded tokens with and without compression" headerAction={<Badge variant="live">Live Data</Badge>}><TokenUsageComparisonChart withoutGateway={withoutCompression} withGateway={usage?.totalTokens ?? 0} /></Card>
          <Card title="Token Totals" subtitle="Provider-reported and locally counted usage">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Input</p><p className="text-2xl font-mono font-bold">{usage?.totalInputTokens.toLocaleString() ?? '...'}</p></div>
              <div className="p-4 bg-earth-50 rounded border"><p className="text-xs text-earth-500">Output</p><p className="text-2xl font-mono font-bold">{usage?.totalOutputTokens.toLocaleString() ?? '...'}</p></div>
              <div className="p-4 bg-accent-50 rounded border border-accent-200"><p className="text-xs text-accent-700">Total</p><p className="text-2xl font-mono font-bold text-accent-700">{usage?.totalTokens.toLocaleString() ?? '...'}</p></div>
              <div className="p-4 bg-emerald-50 rounded border border-emerald-200"><p className="text-xs text-emerald-700">Compression saved</p><p className="text-2xl font-mono font-bold text-emerald-700">{usage?.tokensSaved.toLocaleString() ?? '...'}</p></div>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={<span className="flex items-center gap-2"><Minimize2 className="w-4 h-4 text-emerald-600" />Prompt Compression</span>} subtitle="Aggregated only when prompts are forwarded upstream">
            <div className="grid grid-cols-2 gap-3 text-sm"><div>Original tokens<br/><strong className="text-xl">{compression?.originalTokens.toLocaleString()}</strong></div><div>Compressed tokens<br/><strong className="text-xl">{compression?.compressedTokens.toLocaleString()}</strong></div><div>Tokens saved<br/><strong className="text-xl text-emerald-600">{compression?.tokensSaved.toLocaleString()}</strong></div><div>Reduction<br/><strong className="text-xl text-accent-600">{compression?.compressionRatio}%</strong></div></div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-clay-600" />Response Tournaments</span>} subtitle="Persisted judge outcomes">
            <div className="grid grid-cols-2 gap-3 text-sm"><div>Tournaments<br/><strong className="text-xl">{tournament?.tournamentsCount}</strong></div><div>Average candidates<br/><strong className="text-xl">{tournament?.averageCandidates}</strong></div><div>Winning score<br/><strong className="text-xl text-clay-600">{tournament?.averageWinningScore}</strong></div><div>Judge fallback rate<br/><strong className="text-xl text-ochre-600">{tournament?.judgeFallbackRate}%</strong></div></div>
          </Card>
        </div>
        <Card title={<span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Metric interpretation</span>} subtitle="Rate-based estimates"><p className="text-sm text-earth-600">USD values use your configured model rates and provider token counts when available. Local fake calls are unpriced. Tournament overhead includes extra candidate and judge calls, so net savings can be negative. These estimates may differ from provider invoices.</p></Card>
      </>}
    </div>
  </div>;
};
