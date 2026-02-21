import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Sparkles, History, Users,
  ChevronLeft, ChevronRight, BarChart2, Mail,
  Shield, User, Eye, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: Shield, dot: 'bg-rose-400', ring: 'ring-rose-400/30' },
  user: { label: 'User', icon: User, dot: 'bg-violet-400', ring: 'ring-violet-400/30' },
  viewer: { label: 'Viewer', icon: Eye, dot: 'bg-sky-400', ring: 'ring-sky-400/30' },
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'user', 'viewer'] },
  { to: '/campaign', label: 'Campaign', icon: Sparkles, roles: ['admin', 'user'] },
  { to: '/history', label: 'History', icon: History, roles: ['admin', 'user', 'viewer'] },
  { to: '/prospects', label: 'Prospects', icon: Users, roles: ['admin', 'user', 'viewer'] },
  { to: '/sent-emails', label: 'Sent Emails', icon: Mail, roles: ['admin', 'user'] },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart2, roles: ['admin'] },
];

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const location = useLocation();
  const { userRole } = useAuth();

  const visible = NAV_ITEMS.filter(item => userRole && item.roles.includes(userRole));
  const role = userRole as 'admin' | 'user' | 'viewer' | null;
  const roleConf = role ? ROLE_CONFIG[role] : null;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #0d1526 60%, #0f1730 100%)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* ── Logo ── */}
      <div className={`h-16 flex items-center flex-shrink-0 border-b border-white/5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <Link to="/" className="group flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-xl bg-indigo-500/30 blur-md group-hover:blur-lg transition-all" />
            <img
              src="/logo.png"
              alt="Infynd Aurevix"
              className="relative w-8 h-8 rounded-xl object-contain group-hover:scale-105 transition-transform duration-200"
            />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <p className="font-extrabold text-white text-sm tracking-tight leading-none whitespace-nowrap">
                  Infynd <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Aurevix</span>
                </p>
                <p className="text-[10px] text-white/30 font-medium tracking-widest uppercase mt-0.5">Marketing OS</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Role Badge ── */}
      <AnimatePresence>
        {!collapsed && roleConf && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-4 pb-1 flex-shrink-0"
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
              <div className={`w-1.5 h-1.5 rounded-full ${roleConf.dot} ring-4 ${roleConf.ring}`} />
              <div className="min-w-0">
                <p className="text-[9px] text-white/30 font-semibold uppercase tracking-widest leading-none">Signed in as</p>
                <p className="text-xs font-bold text-white/80 capitalize mt-0.5">{roleConf.label}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav Label ── */}
      {!collapsed && (
        <p className="px-5 pt-5 pb-2 text-[9px] font-bold text-white/20 uppercase tracking-[0.15em]">Navigation</p>
      )}

      {/* ── Nav Items ── */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'py-4 px-2' : 'px-3 pb-4'} space-y-0.5`}>
        {visible.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'
                } ${isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/80'
                }`}
            >
              {/* Active glow bg */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.2) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}

              {/* Left accent bar */}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-indigo-400"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}

              <Icon
                size={17}
                className={`flex-shrink-0 relative z-10 transition-all ${isActive ? 'text-indigo-300' : 'group-hover:text-white/70'
                  }`}
              />

              {!collapsed && (
                <span className="flex-1 truncate relative z-10">{label}</span>
              )}

              {/* Collapsed active dot */}
              {isActive && collapsed && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}

              {/* Hover glow for inactive */}
              {!isActive && (
                <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/5 transition-all" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Collapse Toggle ── */}
      <div className="flex-shrink-0 p-3 border-t border-white/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center rounded-xl text-white/30 hover:text-white/70 hover:bg-white/5 transition-all py-2 text-xs font-medium ${collapsed ? 'justify-center' : 'gap-2 px-3'
            }`}
        >
          {collapsed ? (
            <ChevronRight size={15} />
          ) : (
            <>
              <ChevronLeft size={15} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
