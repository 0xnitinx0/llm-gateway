import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SimilarityBucket } from '../../types/gateway';

interface SimilarityBarChartProps {
  data: SimilarityBucket[];
}

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded shadow-lg border border-slate-700">
        <p className="font-semibold text-slate-300">Similarity: {label}</p>
        <p className="text-emerald-400 font-mono mt-0.5 font-medium">
          {payload[0].value.toLocaleString()} requests
        </p>
      </div>
    );
  }
  return null;
};

const BUCKET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8'];

export const SimilarityBarChart: React.FC<SimilarityBarChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="range"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
            width={85}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
