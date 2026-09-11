import React from 'react';

export type BadgeVariant = 'live' | 'demo' | 'preview' | 'planned' | 'hit' | 'miss' | 'neutral' | 'success';

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  children,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 font-semibold tracking-wider' : 'text-xs px-2.5 py-1 font-medium';

  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; defaultLabel: string }> = {
    live: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-700',
      border: 'border-emerald-500/30',
      defaultLabel: 'LIVE',
    },
    demo: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-700',
      border: 'border-amber-500/30',
      defaultLabel: 'DEMO',
    },
    preview: {
      bg: 'bg-sky-500/10',
      text: 'text-sky-700',
      border: 'border-sky-500/30',
      defaultLabel: 'PREVIEW',
    },
    planned: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-700',
      border: 'border-purple-500/30',
      defaultLabel: 'PLANNED / DEMO',
    },
    hit: {
      bg: 'bg-emerald-50 text-emerald-700',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      defaultLabel: 'HIT',
    },
    miss: {
      bg: 'bg-slate-100 text-slate-600',
      text: 'text-slate-600',
      border: 'border-slate-200',
      defaultLabel: 'MISS',
    },
    neutral: {
      bg: 'bg-slate-100 text-slate-700',
      text: 'text-slate-700',
      border: 'border-slate-200',
      defaultLabel: '',
    },
    success: {
      bg: 'bg-emerald-50 text-emerald-700',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      defaultLabel: 'Active',
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 uppercase rounded border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {variant === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {children || style.defaultLabel}
    </span>
  );
};
