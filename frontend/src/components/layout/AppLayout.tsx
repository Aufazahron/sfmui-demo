import { useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PoweredByFooter from './PoweredByFooter';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/topology': 'Topology SFM',
  '/logs': 'System Logs',
  '/reports': 'Usage Reports',
  '/users': 'User Management',
  '/settings': 'Settings',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isNodeDetail = matchPath('/topology/:nodeId', location.pathname);
  const pageTitle = isNodeDetail
    ? 'Node Detail'
    : PAGE_TITLES[location.pathname] || 'Smart Flow Meter';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8f9ff' }}>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} pageTitle={pageTitle} />

        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: '24px', background: '#f8f9ff' }}
        >
          <Outlet />
        </main>

        <PoweredByFooter />
      </div>
    </div>
  );
}
