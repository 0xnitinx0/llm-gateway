import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  KeyRound,
  BarChart3,
  Database,
  Settings,
  X,
  Cpu,
} from 'lucide-react';
import { StatusDot } from '../common/StatusDot';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen,
  setIsMobileOpen,
  gatewayOnline,
}) => {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/playground', label: 'Playground', icon: Terminal, highlight: true },
    { to: '/api-keys', label: 'API Keys', icon: KeyRound },
    { to: '/usage', label: 'Usage & Savings', icon: BarChart3 },
    { to: '/cache', label: 'Semantic Cache', icon: Database },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0d131f] text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">LLM Gateway</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Developer Portal</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Small positioning badge */}
        <div className="px-5 py-2.5 bg-slate-900/40 border-b border-slate-800/40">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
            Intelligent LLM Infrastructure
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  } ${item.highlight && !isMobileOpen ? 'relative' : ''}`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.highlight && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase tracking-wider">
                    Core
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section: Health & Version */}
        <div className="p-4 border-t border-slate-800/80 bg-[#090d16]/70 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot
                status={gatewayOnline === null ? 'checking' : gatewayOnline ? 'online' : 'offline'}
                text={gatewayOnline === null ? 'Checking...' : gatewayOnline ? 'Gateway Online' : 'Gateway Offline'}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
              v0.1.0
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Single endpoint · Unified optimization
          </p>
        </div>
      </aside>
    </>
  );
};
