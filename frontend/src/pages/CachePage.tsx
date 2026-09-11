import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SimilarityBarChart } from '../components/charts/SimilarityBarChart';
import {
  getCacheSummary,
  getSimilarityDistribution,
  getCacheActivity,
} from '../../src/services/cache';
import {
  CacheBreakdown,
  SimilarityBucket,
  CacheEntryActivity,
} from '../types/gateway';
import {
  Database,
  Zap,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const CachePage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [cacheSummary, setCacheSummary] = useState<CacheBreakdown | null>(null);
  const [similarityData, setSimilarityData] = useState<SimilarityBucket[]>([]);
  const [activity, setActivity] = useState<CacheEntryActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [sum, sim, act] = await Promise.all([
          getCacheSummary(),
          getSimilarityDistribution(),
          getCacheActivity(),
        ]);
        if (isMounted) {
          setCacheSummary(sum);
          setSimilarityData(sim);
          setActivity(act);
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
        title="Semantic Cache"
        description="Monitor semantic deduplication performance without exposing user prompts."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={gatewayOnline}
      />

      <div className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
        {/* Strict Privacy Banner */}
        <div className="rounded-lg bg-slate-900 text-white p-4 flex items-center justify-between gap-4 border border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-blue-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Zero-Prompt Exposure Policy
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                The cache engine operates strictly over high-dimensional vector embeddings. Raw prompt contents are never persisted or exposed on observability interfaces.
              </p>
            </div>
          </div>
          <Badge variant="live">Privacy Guarded</Badge>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            label="Cache Hit Rate"
            value={isLoading ? '...' : `${cacheSummary?.hitRate || 67.4}%`}
            sublabel="Vector threshold >= 0.75"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Zap className="w-4 h-4 text-emerald-500" />}
          />
          <MetricCard
            label="Total Cached Entries"
            value={isLoading ? '...' : (cacheSummary?.hits || 842).toLocaleString()}
            sublabel="Active vector embeddings"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Database className="w-4 h-4 text-blue-500" />}
          />
          <MetricCard
            label="Requests Served From Cache"
            value={isLoading ? '...' : '436'}
            sublabel="Zero model tokens consumed"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Layers className="w-4 h-4 text-purple-500" />}
          />
          <MetricCard
            label="Average Similarity"
            value={isLoading ? '...' : '0.89'}
            sublabel="Cosine match quality"
            badgeVariant="demo"
            badgeText="Demo"
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
          />
        </div>

        {/* Similarity Distribution Chart */}
        <Card
          title="Similarity Distribution"
          subtitle="Frequency breakdown of vector cosine similarity scores on incoming queries"
          headerAction={<Badge variant="demo">Demo Data</Badge>}
        >
          <div className="space-y-3">
            <SimilarityBarChart data={similarityData} />
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-3">
              <span>Threshold line: <strong>0.75</strong> (queries above 0.75 are evaluated as semantic cache hits)</span>
              <span className="font-mono">Cosine distance model: text-embedding-004</span>
            </div>
          </div>
        </Card>

        {/* Recent Cache Activity Table */}
        <Card
          title="Recent Cache Activity"
          subtitle="Anonymized vector lookup results and entry IDs"
          headerAction={<Badge variant="demo">Demo Telemetry</Badge>}
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Time</th>
                  <th className="py-3 px-5">Entry ID</th>
                  <th className="py-3 px-5">Similarity</th>
                  <th className="py-3 px-5">Result</th>
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
                    <td className="py-3 px-5">
                      <span
                        className={`font-semibold ${
                          item.similarity >= 0.85
                            ? 'text-emerald-700'
                            : item.similarity >= 0.75
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {item.similarity}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-sans">
                      <Badge variant={item.result === 'HIT' ? 'hit' : 'miss'}>
                        {item.result}
                      </Badge>
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
