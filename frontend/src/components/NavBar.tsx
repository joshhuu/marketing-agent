import { LogOut, Shield, User as UserIcon, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavBarProps {
  collapsed: boolean;
}

export function NavBar({ collapsed }: NavBarProps) {
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const getRoleIcon = () => {
    switch (userRole) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'user':
        return <UserIcon className="w-4 h-4" />;
      case 'viewer':
        return <Eye className="w-4 h-4" />;
      default:
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getRoleColor = () => {
    switch (userRole) {
      case 'admin':
        return 'text-red-600 dark:text-red-400';
      case 'user':
        return 'text-purple-600 dark:text-purple-400';
      case 'viewer':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <header 
      className="fixed top-0 right-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border/60 transition-all duration-300"
      style={{ left: collapsed ? '64px' : '256px' }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-4">
          {/* User Role Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent">
            <div className={getRoleColor()}>
              {getRoleIcon()}
            </div>
            <span className="text-sm font-medium capitalize">{userRole}</span>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {userRole?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>Current Role</span>
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    {userRole}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
