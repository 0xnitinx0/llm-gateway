import React from 'react';
import { useReducedMotion } from 'framer-motion';
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
      <div className="chart-tooltip text-xs px-3 py-2">
        <p className="font-semibold text-earth-300">{label}</p>
        <p className="text-accent-300 font-mono mt-0.5 font-medium">
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
  const reducedMotion = useReducedMotion();
  const data = [
    { name: 'Without Gateway', tokens: withoutGateway, color: '#BDA98F' },
    { name: 'With Gateway', tokens: withGateway, color: '#B84C24' },
  ];

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3EBDD" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: '#DDCFBC' }}
            tick={{ fill: '#5E4D40', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#746354', fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar isAnimationActive={!reducedMotion} animationBegin={0} animationDuration={600} dataKey="tokens" radius={[4, 4, 0, 0]} barSize={48}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
