import { useNavigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { initials, roleLabel } from '@/types/auth';

interface HeaderProps {
  setSidebarOpen: (isOpen: boolean) => void;
  pageTitle?: string;
}

export default function Header({ setSidebarOpen, pageTitle = 'Smart Flow Meter' }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sfm-header sticky top-0 z-30 flex h-16 items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-xl" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
          {pageTitle}
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-colors hover:bg-[#f8f9ff]"
            style={{ borderColor: '#e2e8f0', background: '#ffffff' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: '#091426', color: '#57dffe' }}
            >
              {user ? initials(user.name) : '—'}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: '#0d1c2d' }}>{user?.name ?? 'Guest'}</div>
              <div className="text-xs truncate" style={{ color: '#75777d' }}>{user ? roleLabel(user.role) : ''}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-3 py-2">
            <div className="font-semibold text-sm">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{user ? roleLabel(user.role) : ''}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive gap-2" onClick={() => void handleLogout()}>
            <LogOut className="w-4 h-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
