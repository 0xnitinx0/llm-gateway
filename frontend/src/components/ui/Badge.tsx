import React from 'react';

export type BadgeVariant = 'live' | 'demo' | 'preview' | 'planned' | 'hit' | 'miss' | 'neutral' | 'success' | 'warning' | 'error';

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
    warning: { bg: 'bg-ochre-50', text: 'text-ochre-700', border: 'border-ochre-200', defaultLabel: 'Attention' },
    error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', defaultLabel: 'Error' },
    live: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-700',
      border: 'border-emerald-500/30',
      defaultLabel: 'LIVE',
    },
    demo: {
      bg: 'bg-ochre-500/10',
      text: 'text-ochre-700',
      border: 'border-ochre-500/30',
      defaultLabel: 'DEMO',
    },
    preview: {
      bg: 'bg-accent-500/10',
      text: 'text-accent-700',
      border: 'border-accent-500/30',
      defaultLabel: 'PREVIEW',
    },
    planned: {
      bg: 'bg-clay-500/10',
      text: 'text-clay-700',
      border: 'border-clay-500/30',
      defaultLabel: 'PLANNED / DEMO',
    },
    hit: {
      bg: 'bg-emerald-50 text-emerald-700',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      defaultLabel: 'HIT',
    },
    miss: {
      bg: 'bg-earth-100 text-earth-600',
      text: 'text-earth-600',
      border: 'border-earth-200',
      defaultLabel: 'MISS',
    },
    neutral: {
      bg: 'bg-earth-100 text-earth-700',
      text: 'text-earth-700',
      border: 'border-earth-200',
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
      className={`inline-flex w-fit items-center gap-1 uppercase rounded border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {variant === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {children || style.defaultLabel}
    </span>
  );
};
