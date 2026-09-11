import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { TokenUsageComparisonChart } from '../components/charts/TokenUsageComparisonChart';
import {
  getUsageMetrics,
  getCompressionMetrics,
  getTournamentMetrics,
} from '../../src/services/metrics';
import {
  UsageMetrics,
  CompressionMetrics,
  TournamentMetrics,
} from '../types/gateway';
import {
  Minimize2,
  Database,
  Trophy,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface OutletContextType {
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const UsagePage: React.FC = () => {
  const { setIsMobileOpen, gatewayOnline } = useOutletContext<OutletContextType>();

  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [compression, setCompression] = useState<CompressionMetrics | null>(null);
  const [tournament, setTournament] = useState<TournamentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [u, c, t] = await Promise.all([
          getUsageMetrics(),
          getCompressionMetrics(),
          getTournamentMetrics(),
        ]);
        if (isMounted) {
          setUsage(u);
          setCompression(c);
          setTournament(t);
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
        title="Usage & Savings"
        description="Understand gateway request volume, token reduction, and financial optimization impact."
        onOpenMobileSidebar={() => setIsMobileOpen(true)}
        gatewayOnline={gatewayOnline}
      />

      <div className="px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <MetricCard
            label="Total Requests"
            value={isLoading ? '...' : usage?.totalRequests.toLocaleString() || '1,248'}
            sublabel="Received by gateway"
            badgeVariant="demo"
            badgeText="Demo"
          />
          <MetricCard
            label="LLM Calls"
            value={isLoading ? '...' : usage?.llmCalls.toLocaleString() || '812'}
            sublabel="Forwarded to provider"
            badgeVariant="demo"
            badgeText="Demo"
          />
          <MetricCard
            label="Cache Hits"
            value={isLoading ? '...' : usage?.cacheHits.toLocaleString() || '436'}
            sublabel="Zero-provider calls"
            badgeVariant="demo"
            badgeText="Demo"
          />
          <MetricCard
            label="Tokens Saved"
            value={isLoading ? '...' : usage?.tokensSaved.toLocaleString() || '42,180'}
            sublabel="Combined reduction"
            badgeVariant="demo"
            badgeText="Demo"
          />
          <MetricCard
            label="Estimated Cost Saved"
            value={isLoading ? '...' : `$${usage?.estimatedCostSaved.toFixed(2) || '12.84'}`}
            sublabel="Theoretical savings"
            badgeVariant="demo"
            badgeText="Demo"
          />
        </div>

        {/* Token Usage & Cost Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token Analytics Card */}
          <Card
            title="Token Usage Comparison"
            subtitle="Comparing standard direct provider calls vs. Gateway-optimized traffic"
            headerAction={<Badge variant="demo">Demo Data</Badge>}
          >
            <div className="space-y-4">
              <TokenUsageComparisonChart
                withoutGateway={usage?.withoutGatewayTokens || 60240}
                withGateway={usage?.withGatewayTokens || 42180}
              />

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Tokens Saved
                  </span>
                  <div className="text-xl font-bold text-blue-600 font-mono mt-0.5">
                    18,060
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Saved via prompt compression
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Compression Ratio
                  </span>
                  <div className="text-xl font-bold text-emerald-600 font-mono mt-0.5">
                    70%
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Context size retained
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Cost Comparison Card */}
          <Card
            title="Estimated Cost Breakdown"
            subtitle="Calculated based on standard token pricing across unified gateway workloads"
            headerAction={<Badge variant="demo">Demo Estimate</Badge>}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50/80 rounded-lg border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">Without Gateway</span>
                  <div className="text-2xl font-bold text-slate-700 font-mono mt-2">
                    ${usage?.costWithoutGateway.toFixed(2) || '38.40'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Uncached raw token usage
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200/80">
                  <span className="text-xs font-semibold text-blue-800">With Gateway</span>
                  <div className="text-2xl font-bold text-blue-700 font-mono mt-2">
                    ${usage?.costWithGateway.toFixed(2) || '25.56'}
                  </div>
                  <p className="text-[11px] text-blue-600 mt-1">
                    Intelligently optimized
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-800">Est. Savings</span>
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono mt-2">
                    ${usage?.estimatedCostSaved.toFixed(2) || '12.84'}
                  </div>
                  <p className="text-[11px] text-emerald-600 mt-1">
                    33.4% financial reduction
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-md bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Estimated figures:</strong> These metrics simulate monthly cost projections based on provider token rates. They represent the architectural value proposition rather than live billing invoices.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Optimization Sources Breakdown */}
        <Card
          title="Optimization Impact Breakdown"
          subtitle="How deduplication and compression jointly eliminate redundant spend"
          headerAction={<Badge variant="demo">Demo Breakdown</Badge>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-800">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Semantic Deduplication</span>
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">
                24,120 tokens
              </div>
              <p className="text-xs text-slate-600">
                Estimated savings: <strong>$7.33</strong>. Eliminates full model inference calls when previous answers match query semantics.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-slate-800">
                <Minimize2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Prompt Compression</span>
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">
                18,060 tokens
              </div>
              <p className="text-xs text-slate-600">
                Estimated savings: <strong>$5.51</strong>. Prunes verbose framing and extraneous tokens while retaining core instructions.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/30 space-y-2">
              <div className="flex items-center gap-2 text-blue-900">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Total Combined Impact</span>
              </div>
              <div className="text-xl font-bold text-blue-700 font-mono">
                42,180 tokens
              </div>
              <p className="text-xs text-blue-900">
                Total savings: <strong>$12.84</strong>. A 33.4% net efficiency improvement across all routed traffic.
              </p>
            </div>
          </div>
        </Card>

        {/* Dedicated Section 1: Adaptive Prompt Compression UI */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Minimize2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-900">Adaptive Prompt Compression</span>
            </div>
          }
          subtitle="Reduce redundant context before forwarding requests to provider"
          headerAction={<Badge variant="demo">DEMO</Badge>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Original Tokens</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {compression?.originalTokens || 420}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Compressed Tokens</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {compression?.compressedTokens || 294}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Tokens Saved</span>
                <div className="text-xl font-bold text-emerald-600 font-mono mt-1">
                  {compression?.tokensSaved || 126}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Compression Ratio</span>
                <div className="text-xl font-bold text-blue-600 font-mono mt-1">
                  {compression?.compressionRatio || 70}%
                </div>
              </div>
            </div>

            {/* Before / After Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-sans text-[11px] font-semibold uppercase">
                  <span>Input Prompt (Raw)</span>
                  <span className="text-slate-500">420 tokens</span>
                </div>
                <p className="leading-relaxed bg-white p-2.5 rounded border border-slate-200/80">
                  "Please act as an experienced computer scientist. Could you kindly provide me with a comprehensive, step-by-step, thorough explanation of the core principles of quantum computing specifically tailored for..."
                </p>
              </div>

              <div className="p-3.5 rounded-md border border-emerald-200 bg-emerald-50/40 text-xs font-mono text-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-emerald-700 font-sans text-[11px] font-semibold uppercase">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Compressed Prompt (Forwarded)
                  </span>
                  <span className="text-emerald-700 font-bold">294 tokens (-30%)</span>
                </div>
                <p className="leading-relaxed bg-white p-2.5 rounded border border-emerald-200/80">
                  "Explain core principles of quantum computing step-by-step for a first-year computer science student, focusing on qubits, superposition, and entanglement."
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Dedicated Section 2: Multi-Model Response Tournament UI */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-slate-900">Multi-Model Response Tournament</span>
            </div>
          }
          subtitle="The Gateway can evaluate multiple candidate responses and autonomously select the strongest result"
          headerAction={<Badge variant="planned">PLANNED / DEMO</Badge>}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Tournaments</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {tournament?.tournamentsCount || 124}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Avg. Candidates</span>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {tournament?.averageCandidates || 3}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Avg. Judge Score</span>
                <div className="text-xl font-bold text-purple-600 font-mono mt-1">
                  {tournament?.averageJudgeScore || 0.87}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium uppercase">Best Response Rate</span>
                <div className="text-xl font-bold text-emerald-600 font-mono mt-1">
                  {tournament?.bestResponseRate || 82}%
                </div>
              </div>
            </div>

            {/* Conceptual Tournament Pipeline Diagram */}
            <div className="p-5 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Tournament Execution Flow (Autonomous Gateway Selection)
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Step 1 */}
                <div className="w-full md:w-1/4 p-3 bg-white rounded-md border border-slate-200 text-center shadow-2xs">
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Step 1</span>
                  <h5 className="text-xs font-semibold text-slate-900 mt-1">Incoming Request</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">POST /v1/chat/completions</p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />

                {/* Step 2 */}
                <div className="w-full md:w-1/3 p-3 bg-white rounded-md border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="text-center">
                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Step 2: Candidates</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="px-2 py-1 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span className="font-medium text-slate-700">Candidate A</span>
                      <span className="text-[10px] text-slate-400 font-mono">Latency 1.1s</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <span className="font-semibold text-emerald-800">Candidate B (Winner)</span>
                      <span className="text-[10px] text-emerald-600 font-mono">Score 0.94</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span className="font-medium text-slate-700">Candidate C</span>
                      <span className="text-[10px] text-slate-400 font-mono">Score 0.81</span>
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />

                {/* Step 3 */}
                <div className="w-full md:w-1/4 p-3 bg-white rounded-md border border-slate-200 text-center shadow-2xs">
                  <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Step 3: Judge</span>
                  <h5 className="text-xs font-semibold text-slate-900 mt-1">LLM Evaluation Judge</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ranks reasoning & accuracy</p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />

                {/* Step 4 */}
                <div className="w-full md:w-1/4 p-3 bg-emerald-50/80 rounded-md border border-emerald-200 text-center shadow-2xs">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Step 4: Result</span>
                  <h5 className="text-xs font-semibold text-emerald-900 mt-1">Selected Response</h5>
                  <p className="text-[10px] text-emerald-700 mt-0.5 font-mono">Delivered to developer</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
