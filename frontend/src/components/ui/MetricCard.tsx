import React from 'react';
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
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200/80 p-5 shadow-sm transition-all hover:border-slate-300/80 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">{label}</span>
        <div className="flex items-center gap-1.5">
          {badgeVariant && (
            <Badge variant={badgeVariant} size="sm">
              {badgeText}
            </Badge>
          )}
          {icon && <span className="text-slate-400">{icon}</span>}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-sans">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.isPositive ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{sublabel}</p>
      )}
    </div>
  );
};
