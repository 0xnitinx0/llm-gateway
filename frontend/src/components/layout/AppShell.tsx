import React, { useState } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { useWorkspace } from '../../state/WorkspaceSession';

export const AppShell: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { online: gatewayOnline, mode } = useWorkspace();
  const { pathname } = useLocation();
  const outlet = useOutlet({ setIsMobileOpen, gatewayOnline });
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <div className="paper-canvas min-h-screen flex">
        <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} gatewayOnline={gatewayOnline} />
        <div className="flex-1 flex flex-col min-w-0 lg:pl-56">
          <main className="flex-1 pb-12">
            {mode === 'sample' && <div className="sample-notice rounded-none border-x-0 border-t-0 text-xs" role="status"><strong>Sample demo</strong> · Demo and Playground actions use illustrative results. Monitoring pages show live telemetry. <Link className="underline" to="/demo">Open walkthrough</Link></div>}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial="hidden"
                animate="visible"
                exit={{ opacity: reducedMotion ? 1 : 0, transition: { duration: reducedMotion ? 0 : 0.1 } }}
                variants={{
                  hidden: { opacity: reducedMotion ? 1 : 0 },
                  visible: { opacity: 1, transition: { duration: reducedMotion ? 0 : 0.2, staggerChildren: reducedMotion ? 0 : 0.025 } },
                }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
};
