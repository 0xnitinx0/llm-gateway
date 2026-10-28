import React from 'react';
import { motion } from 'framer-motion';
import { useEntrance } from './motion';
import { Badge, BadgeVariant } from './Badge';

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  badgeVariant?: BadgeVariant;
  badgeText?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sublabel,
  badgeVariant,
  badgeText,
  icon,
  trend,
  className = '',
}) => {
  const entrance = useEntrance();
  return (
    <motion.div
      variants={entrance}
      className={`metric-card ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-[10px] font-semibold text-earth-500 tracking-wide uppercase">{label}</span>
        <div className="flex items-center gap-1.5">
          {badgeVariant && (
            <Badge variant={badgeVariant} size="sm">
              {badgeText}
            </Badge>
          )}
          {icon && <span className="text-earth-500">{icon}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl xl:text-3xl font-semibold tabular-nums text-earth-900 tracking-tight font-sans">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.isPositive ? 'text-emerald-600' : 'text-earth-500'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-xs text-earth-500 mt-1.5 leading-relaxed">{sublabel}</p>
      )}
    </motion.div>
  );
};
