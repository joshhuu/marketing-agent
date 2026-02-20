import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sparkles, History, Users, ChevronLeft, ChevronRight, BarChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const location = useLocation();
  const { userRole } = useAuth();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'user', 'viewer'] },
    { to: '/campaign', label: 'Campaign', icon: Sparkles, roles: ['admin', 'user'] },
    { to: '/history', label: 'History', icon: History, roles: ['admin', 'user', 'viewer'] },
    { to: '/prospects', label: 'Prospects', icon: Users, roles: ['admin', 'user', 'viewer'] },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart, roles: ['admin'] },
  ];

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border/60 transition-all duration-300 z-50 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/60">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground tracking-tight">
                Campaign<span className="text-gradient">AI</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <Link to="/" className="flex items-center justify-center w-full group">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
            </Link>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-3">
            {visibleNavItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isActive 
                      ? 'text-primary bg-accent' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="flex-1">{label}</span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 w-1 h-8 bg-primary rounded-r-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Toggle Button */}
        <div className="p-3 border-t border-border/60">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
