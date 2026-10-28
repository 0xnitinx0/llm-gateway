import React from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RequestDataPoint } from '../../types/gateway';

interface RequestOverviewChartProps {
  data: RequestDataPoint[];
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
          {payload[0].value.toLocaleString()} requests
        </p>
      </div>
    );
  }
  return null;
};

export const RequestOverviewChart: React.FC<RequestOverviewChartProps> = ({ data }) => {
  const reducedMotion = useReducedMotion();
  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3EBDD" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: '#DDCFBC' }}
            tick={{ fill: '#746354', fontSize: 12 }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#746354', fontSize: 12 }}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            isAnimationActive={!reducedMotion} animationBegin={0}
            animationDuration={600}
            type="monotone"
            dataKey="requests"
            stroke="#B84C24"
            strokeWidth={2}
            fillOpacity={0.12}
            fill="#B84C24"
            dot={{ r: 3, fill: '#B84C24', strokeWidth: 1, stroke: '#FFFAF2' }}
            activeDot={{ r: 5, fill: '#923B1D', stroke: '#FFFAF2', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
