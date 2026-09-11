import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CacheBreakdown } from '../../types/gateway';

interface CacheDonutChartProps {
  data: CacheBreakdown;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded shadow-lg border border-slate-700">
        <p className="font-semibold text-slate-300">{payload[0].name}</p>
        <p className="font-mono text-emerald-400 mt-0.5">
          {payload[0].value.toLocaleString()} requests
        </p>
      </div>
    );
  }
  return null;
};

export const CacheDonutChart: React.FC<CacheDonutChartProps> = ({ data }) => {
  const chartData = [
    { name: 'Cache Hits', value: data.hits, color: '#10b981' },
    { name: 'Cache Misses', value: data.misses, color: '#cbd5e1' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      <div className="relative w-44 h-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 font-sans tracking-tight">
            {data.hitRate}%
          </span>
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
            Hit Rate
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-w-[140px]">
        <div className="flex items-center justify-between gap-4 p-2.5 rounded-md bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-medium text-slate-600">Cache Hits</span>
          </div>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {data.hits.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 p-2.5 rounded-md bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
            <span className="text-xs font-medium text-slate-600">Cache Misses</span>
          </div>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {data.misses.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
