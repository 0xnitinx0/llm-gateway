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

interface TokenUsageComparisonChartProps {
  withoutGateway: number;
  withGateway: number;
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
        <p className="font-semibold text-slate-300">{label}</p>
        <p className="text-blue-400 font-mono mt-0.5 font-medium">
          {payload[0].value.toLocaleString()} tokens
        </p>
      </div>
    );
  }
  return null;
};

export const TokenUsageComparisonChart: React.FC<TokenUsageComparisonChartProps> = ({
  withoutGateway,
  withGateway,
}) => {
  const data = [
    { name: 'Without Gateway', tokens: withoutGateway, color: '#94a3b8' },
    { name: 'With Gateway', tokens: withGateway, color: '#2563eb' },
  ];

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="tokens" radius={[4, 4, 0, 0]} barSize={48}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
