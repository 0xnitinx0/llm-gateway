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
      <div className="chart-tooltip text-xs px-3 py-2">
        <p className="font-semibold text-earth-300">Similarity: {label}</p>
        <p className="text-accent-300 font-mono mt-0.5 font-medium">
          {payload[0].value.toLocaleString()} requests
        </p>
      </div>
    );
  }
  return null;
};

const BUCKET_COLORS = ['#B84C24', '#C76A42', '#D3A06A', '#BDA98F'];

export const SimilarityBarChart: React.FC<SimilarityBarChartProps> = ({ data }) => {
  const reducedMotion = useReducedMotion();
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3EBDD" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: '#DDCFBC' }}
            tick={{ fill: '#746354', fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="range"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#5E4D40', fontSize: 12, fontWeight: 500 }}
            width={85}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar isAnimationActive={!reducedMotion} animationBegin={0} animationDuration={600} dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
