import React from 'react';
import { Menu } from 'lucide-react';
import { StatusDot } from '../common/StatusDot';

interface PageHeaderProps {
  title: string;
  description?: string;
  onOpenMobileSidebar?: () => void;
  gatewayOnline?: boolean | null;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  onOpenMobileSidebar,
  gatewayOnline,
  actions,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-md border-b border-earth-200/80 px-4 sm:px-8 py-4 sm:py-5">
      <div className="max-w-[1376px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onOpenMobileSidebar && (
            <button
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-1.5 rounded-md text-earth-600 hover:text-earth-900 hover:bg-earth-200/60 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-earth-900 tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs sm:text-sm text-earth-500 mt-1.5 max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {actions}
          {gatewayOnline !== undefined && (
            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-md bg-surface border border-earth-200 shadow-2xs">
              <StatusDot
                status={gatewayOnline === null ? 'checking' : gatewayOnline ? 'online' : 'offline'}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
