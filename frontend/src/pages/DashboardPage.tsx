import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { RequestOverviewChart } from '../components/charts/RequestOverviewChart';
import { CacheDonutChart } from '../components/charts/CacheDonutChart';
import {
  getDashboardMetrics,
  getRequestOverviewData,
  getCacheBreakdown,
  getRecentActivity,
} from '../../src/services/metrics';
import {
  DashboardMetrics,
  RequestDataPoint,
  CacheBreakdown,
  ActivityLogItem,
} from '../types/gateway';
import {
  Terminal,
  Activity,
  Database,
  Minimize2,
  Trophy,
  Zap,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const DashboardPage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<RequestDataPoint[]>([]);
  const [cacheData, setCacheData] = useState<CacheBreakdown | null>(null);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [m, c, cb, a] = await Promise.all([
          getDashboardMetrics(),
          getRequestOverviewData(),
          getCacheBreakdown(),
          getRecentActivity(),
        ]);
        if (isMounted) {
          setMetrics(m);
          setChartData(c);
          setCacheData(cb);
          setActivity(a);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Monitor gateway performance and optimization impact across all connected LLM workloads."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={gatewayOnline}
        actions={
          <Link to="/playground">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Terminal className="w-3.5 h-3.5" />}
            >
              Open Playground
            </Button>
          </Link>
        }
      />

      <div className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
        {/* Architectural Concept Banner */}
        <div className="rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 text-white shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Intelligent Architecture
                </span>
                <Badge variant="demo">Demo Telemetry</Badge>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                One Gateway. Three Pillars of Intelligent Optimization.
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Developers send prompts to a single endpoint. The Gateway handles Semantic Deduplication, Adaptive Prompt Compression, and Multi-Model Response Tournaments transparently.
              </p>
            </div>
            <Link to="/playground" className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Test Live Endpoint
              </Button>
            </Link>
          </div>
        </div>

        {/* Top-Level KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <MetricCard
            label="Total Requests"
            value={isLoading ? '...' : metrics?.totalRequests.toLocaleString() || '1,248'}
            sublabel="Through gateway proxy"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Activity className="w-4 h-4" />}
          />
          <MetricCard
            label="Cache Hit Rate"
            value={isLoading ? '...' : `${metrics?.cacheHitRate || 67.4}%`}
            sublabel="Vector similarity >= 0.75"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Zap className="w-4 h-4 text-emerald-500" />}
          />
          <MetricCard
            label="Tokens Saved"
            value={isLoading ? '...' : metrics?.tokensSaved.toLocaleString() || '42,180'}
            sublabel="Deduplication + compression"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Minimize2 className="w-4 h-4 text-blue-500" />}
          />
          <MetricCard
            label="Est. Savings"
            value={isLoading ? '...' : `$${metrics?.estimatedSavings.toFixed(2) || '12.84'}`}
            sublabel="Provider cost avoided"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          />
          <MetricCard
            label="Avg. Latency"
            value={isLoading ? '...' : `${metrics?.averageLatencySec || 1.24}s`}
            sublabel="Combined cache & LLM"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Request Overview Chart */}
        <Card
          title="Request Overview"
          subtitle="Daily requests handled by the gateway"
          headerAction={<Badge variant="demo">Demo Data</Badge>}
        >
          <RequestOverviewChart data={chartData} />
        </Card>

        {/* Middle Section: Cache Performance & Gateway Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cache Performance Card */}
          <Card
            title="Cache Performance"
            subtitle="Semantic vector hits vs misses"
            headerAction={<Badge variant="demo">Demo Metric</Badge>}
            className="lg:col-span-1"
          >
            {cacheData ? (
              <CacheDonutChart data={cacheData} />
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                Loading cache metrics...
              </div>
            )}
          </Card>

          {/* Gateway Intelligence Cards (3 Pillars) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Gateway Intelligence
                </h3>
                <p className="text-xs text-slate-500">
                  How the gateway optimizes every request
                </p>
              </div>
              <Badge variant="preview">Architecture Preview</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Semantic Deduplication */}
              <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Database className="w-3.5 h-3.5" />
                    </div>
                    <Badge variant="demo">Demo metric</Badge>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Semantic Deduplication
                  </h4>
                  <div className="mt-2.5">
                    <span className="text-2xl font-bold text-slate-900 font-mono">67.4%</span>
                    <p className="text-[11px] text-slate-500 font-medium">cache hit rate</p>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    436 requests served directly from cache. Fewer redundant LLM calls save compute and cost.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-blue-600 font-medium">
                  <Sparkles className="w-3 h-3" />
                  <span>Sub-150ms cache response</span>
                </div>
              </div>

              {/* Card 2: Prompt Compression */}
              <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Minimize2 className="w-3.5 h-3.5" />
                    </div>
                    <Badge variant="demo">Demo metric</Badge>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Prompt Compression
                  </h4>
                  <div className="mt-2.5">
                    <span className="text-2xl font-bold text-slate-900 font-mono">30%</span>
                    <p className="text-[11px] text-slate-500 font-medium">token reduction</p>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    18,060 tokens saved. Strips redundant prompt context before forwarding to the provider.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <Sparkles className="w-3 h-3" />
                  <span>Preserves 100% semantic intent</span>
                </div>
              </div>

              {/* Card 3: Response Tournament */}
              <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                    <Badge variant="planned">Planned / Demo</Badge>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Response Tournament
                  </h4>
                  <div className="mt-2.5">
                    <span className="text-2xl font-bold text-slate-900 font-mono">124</span>
                    <p className="text-[11px] text-slate-500 font-medium">tournaments run</p>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    3 candidates evaluated on average. Best response autonomously selected by gateway judge.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-purple-600 font-medium">
                  <Sparkles className="w-3 h-3" />
                  <span>Autonomous quality ranking</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Table (No raw prompts per privacy rule!) */}
        <Card
          title="Recent Activity"
          subtitle="Request identifiers and vector cache similarity (prompt contents strictly protected)"
          headerAction={<Badge variant="demo">Demo Telemetry</Badge>}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Time</th>
                  <th className="py-3 px-5">Request ID</th>
                  <th className="py-3 px-5">Result</th>
                  <th className="py-3 px-5">Similarity</th>
                  <th className="py-3 px-5 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {activity.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 text-slate-500 font-sans">{item.time}</td>
                    <td className="py-3 px-5 font-semibold text-slate-900">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {item.id}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-sans">
                      <Badge variant={item.result === 'HIT' ? 'hit' : 'miss'}>
                        {item.result}
                      </Badge>
                    </td>
                    <td className="py-3 px-5">
                      {item.similarity !== null ? (
                        <span className="text-emerald-700 font-medium">{item.similarity}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right font-medium text-slate-900">
                      {item.latency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
