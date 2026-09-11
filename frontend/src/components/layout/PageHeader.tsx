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
    <header className="sticky top-0 z-30 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onOpenMobileSidebar && (
            <button
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          {gatewayOnline !== undefined && (
            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-md bg-white border border-slate-200 shadow-2xs">
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
