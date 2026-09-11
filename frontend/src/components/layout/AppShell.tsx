import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { checkGatewayHealth } from '../../services/gateway';

export const AppShell: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const isOnline = await checkGatewayHealth();
      if (isMounted) setGatewayOnline(isOnline);
    };

    check();
    const interval = setInterval(check, 30000); // lightweight check every 30s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        gatewayOnline={gatewayOnline}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <main className="flex-1 pb-12">
          <Outlet context={{ setIsMobileOpen, gatewayOnline }} />
        </main>
      </div>
    </div>
  );
};
