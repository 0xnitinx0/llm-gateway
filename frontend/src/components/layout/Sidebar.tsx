import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, Terminal, KeyRound, BarChart3, Database, Settings, X, Cpu, ArrowUpRight, Play } from 'lucide-react';
import { StatusDot } from '../common/StatusDot';
import { smoothTransition } from '../ui/motion';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  gatewayOnline: boolean | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, setIsMobileOpen, gatewayOnline }) => {
  const { pathname } = useLocation();
  const reducedMotion = useReducedMotion();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace' },
    { to: '/demo', label: 'Guided demo', icon: Play, group: 'Workspace' },
    { to: '/playground', label: 'Playground', icon: Terminal, group: 'Workspace' },
    { to: '/usage', label: 'Usage & Savings', icon: BarChart3, group: 'Monitoring' },
    { to: '/cache', label: 'Semantic Cache', icon: Database, group: 'Monitoring' },
    { to: '/api-keys', label: 'API Keys', icon: KeyRound, group: 'Administration' },
    { to: '/settings', label: 'Settings', icon: Settings, group: 'Administration' },
  ];

  useEffect(() => {
    if (!isMobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
      if (event.key !== 'Tab') return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>('a, button');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const handleResize = () => { if (window.innerWidth >= 1024) setIsMobileOpen(false); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      previousFocus?.focus();
    };
  }, [isMobileOpen, setIsMobileOpen]);

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 bg-earth-900/35 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)} aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <aside
        ref={sidebarRef}
        aria-label="Main navigation"
        className={`workspace-sidebar fixed inset-y-0 left-0 z-50 w-56 bg-[#EFE3D0] text-earth-700 flex flex-col border-r border-earth-200 ${isMobileOpen ? 'is-open' : ''}`}
      >
        <div className="px-4 pt-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-earth-800 flex items-center justify-center text-surface shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-semibold text-earth-900 tracking-tight">LLM Gateway</span>
              <p className="text-[11px] text-earth-500 mt-0.5">Intelligence workspace</p>
            </div>
          </div>
          <button ref={closeRef} onClick={() => setIsMobileOpen(false)} aria-label="Close sidebar" className="lg:hidden p-1 text-earth-500 rounded-md hover:bg-earth-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto border-t border-earth-200/70" aria-label="Pages">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <React.Fragment key={item.to}>
              {index === 0 || navItems[index - 1].group !== item.group ? <p className="px-3 pt-5 pb-2 text-[10px] uppercase font-semibold tracking-[0.16em] text-earth-500">{item.group}</p> : null}
              <NavLink to={item.to} onClick={() => setIsMobileOpen(false)} className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'text-accent-800' : 'text-earth-600 hover:text-earth-900 hover:bg-surface/50'}`}>
                {active && <motion.span layoutId="active-navigation" className="absolute inset-0 rounded-lg bg-surface border border-earth-200 shadow-sm" transition={reducedMotion ? { duration: 0 } : smoothTransition} />}
                <Icon className={`relative w-[18px] h-[18px] shrink-0 ${active ? 'text-accent-600' : ''}`} />
                <span className="relative flex-1">{item.label}</span>
                {active && <ArrowUpRight className="relative w-3.5 h-3.5 text-accent-500" />}
              </NavLink>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 mt-4 p-3 rounded-lg border border-earth-200 bg-surface/60">
          <div className="flex items-center justify-between gap-2">
            <StatusDot status={gatewayOnline === null ? 'checking' : gatewayOnline ? 'online' : 'offline'} text={gatewayOnline === null ? 'Checking...' : gatewayOnline ? 'Gateway Online' : 'Gateway Offline'} />
            <span className="text-[10px] font-mono text-earth-500">v0.1.0</span>
          </div>
          <p className="text-[11px] text-earth-500 mt-2 leading-relaxed">One endpoint. Smarter requests.</p>
        </div>
      </aside>
    </>
  );
};
