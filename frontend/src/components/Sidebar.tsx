import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Sparkles, History, Users,
  ChevronLeft, ChevronRight, BarChart, Mail,
  Shield, User, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: Shield, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  user: { label: 'User', icon: User, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'user', 'viewer'] },
  { to: '/campaign', label: 'Campaign', icon: Sparkles, roles: ['admin', 'user'] },
  { to: '/history', label: 'History', icon: History, roles: ['admin', 'user', 'viewer'] },
  { to: '/prospects', label: 'Prospects', icon: Users, roles: ['admin', 'user', 'viewer'] },
  { to: '/sent-emails', label: 'Sent Emails', icon: Mail, roles: ['admin', 'user'] },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart, roles: ['admin'] },
];

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const location = useLocation();
  const { userRole } = useAuth();

  const visible = NAV_ITEMS.filter(item => userRole && item.roles.includes(userRole));
  const role = userRole as 'admin' | 'user' | 'viewer' | null;
  const roleConf = role ? ROLE_CONFIG[role] : null;
  const RoleIcon = roleConf?.icon;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-100 shadow-sm flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* ── Logo ── */}
      <div className={`h-16 flex items-center border-b border-slate-100 flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'px-5 gap-3'}`}>
        <Link to="/" className="group flex items-center gap-3 min-w-0">
          <img
            src="/logo.png"
            alt="Infynd Aurevix"
            className="w-8 h-8 rounded-lg object-contain flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <span className="font-bold text-slate-900 text-sm tracking-tight whitespace-nowrap">
                  Infynd <span className="text-gradient">Aurevix</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Role Badge (expanded only) ── */}
      <AnimatePresence>
        {!collapsed && roleConf && RoleIcon && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-4 pb-2 flex-shrink-0"
          >
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${roleConf.bg} ${roleConf.border}`}>
              <div className={`w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
                <RoleIcon size={14} className={roleConf.color} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-medium leading-none">Signed in as</p>
                <p className={`text-xs font-bold ${roleConf.color} capitalize leading-tight mt-0.5`}>{roleConf.label}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3">
        {!collapsed && (
          <p className="px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Navigation</p>
        )}
        <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
          {visible.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5'
                  } ${isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                {/* Active indicator bar */}
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <Icon
                  size={18}
                  className={`flex-shrink-0 ${isActive ? 'text-indigo-600' : ''}`}
                />

                {!collapsed && (
                  <span className="flex-1 truncate">{label}</span>
                )}

                {/* Active dot for collapsed */}
                {isActive && collapsed && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Collapse Toggle ── */}
      <div className="flex-shrink-0 p-3 border-t border-slate-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={`w-full flex items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all py-2 text-xs font-medium ${collapsed ? 'justify-center' : 'gap-2 px-3'
            }`}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
