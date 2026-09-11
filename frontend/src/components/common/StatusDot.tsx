import React from 'react';

interface StatusDotProps {
  status: 'online' | 'offline' | 'checking';
  text?: string;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  text,
  size = 'sm',
}) => {
  const dotStyles = {
    online: 'bg-emerald-500',
    offline: 'bg-rose-500',
    checking: 'bg-amber-500',
  };

  const textStyles = {
    online: 'text-emerald-700',
    offline: 'text-rose-700',
    checking: 'text-amber-700',
  };

  const defaultLabels = {
    online: 'Gateway Online',
    offline: 'Gateway Offline',
    checking: 'Checking...',
  };

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {status === 'online' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${dotStyles[status]}`} />
      </span>
      {text !== undefined ? (
        <span className={`text-xs font-medium ${textStyles[status]}`}>{text}</span>
      ) : (
        <span className={`text-xs font-medium ${textStyles[status]}`}>{defaultLabels[status]}</span>
      )}
    </span>
  );
};
