import React from 'react';
import { motion } from 'framer-motion';
import { useEntrance } from './motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  headerAction,
  noPadding = false,
}) => {
  const entrance = useEntrance();
  return (
    <motion.div
      variants={entrance}
      className={`gateway-card ${className}`}
    >
      {(title || headerAction) && (
        <div className="px-5 py-4 border-b border-earth-100 flex items-center justify-between gap-4">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-sm font-semibold text-earth-900 tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-earth-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </motion.div>
  );
};
