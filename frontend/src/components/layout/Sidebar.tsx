import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  ScrollText,
  BarChart3,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { initials, roleLabel } from '@/types/auth';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { user, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Topology SFM', path: '/topology', icon: Network },
    { name: 'Logs', path: '/logs', icon: ScrollText },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    ...(isSuperAdmin ? [{ name: 'Users', path: '/users', icon: Users }] : []),
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'sfm-sidebar fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="relative flex h-[88px] items-center justify-center border-b border-white/10 px-3">
          <img
            src="/sfm-logo.png"
            alt="Smart Flow Meter"
            className="h-full w-auto max-w-full object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 lg:hidden h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-2 mb-3">
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#8590a6' }}>
              Navigation
            </span>
          </div>
          {navItems.map((item) => {
            const topologyActive =
              item.path === '/topology' &&
              (pathname === '/topology' || pathname.startsWith('/topology/'));
            return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                cn('sfm-sidebar-nav-item', (isActive || topologyActive) && 'active')
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              {item.name}
            </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: '#1e293b', color: '#bcc7de' }}
            >
              {user ? initials(user.name) : '—'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name ?? 'Guest'}</div>
              <div className="text-xs truncate" style={{ color: '#8590a6' }}>{user ? roleLabel(user.role) : ''}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
