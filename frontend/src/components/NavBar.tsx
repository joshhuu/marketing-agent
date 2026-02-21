import { useState } from 'react';
import { LogOut, Shield, User as UserIcon, Eye, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface NavBarProps {
  collapsed: boolean;
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: Shield, color: 'text-rose-400', bg: 'bg-rose-400/10', dot: 'bg-rose-400' },
  user: { label: 'User', icon: UserIcon, color: 'text-violet-400', bg: 'bg-violet-400/10', dot: 'bg-violet-400' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-sky-400', bg: 'bg-sky-400/10', dot: 'bg-sky-400' },
};

// Derive a readable page title from the current path
const PAGE_TITLE: Record<string, string> = {
  '/': 'Dashboard',
  '/campaign': 'Campaign',
  '/history': 'Campaign History',
  '/prospects': 'Prospects',
  '/sent-emails': 'Sent Emails',
  '/admin/analytics': 'Analytics',
};

const AVATAR_COLORS = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
];

export function NavBar({ collapsed }: NavBarProps) {
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const role = userRole as 'admin' | 'user' | 'viewer' | null;
  const roleConf = role ? ROLE_CONFIG[role] : null;
  const RoleIcon = roleConf?.icon;

  const pageTitle = PAGE_TITLE[location.pathname] ?? 'Overview';
  const avatarGradient = AVATAR_COLORS[(userRole?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const initial = (userRole ?? 'U').charAt(0).toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/welcome');
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 transition-all duration-300 flex items-center"
      style={{
        left: collapsed ? '68px' : '220px',
        background: 'rgba(248, 250, 252, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
      }}
    >
      <div className="flex-1 flex items-center justify-between px-6">
        {/* ── Page title ── */}
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{pageTitle}</h2>
          <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-3">
          {/* Role pill */}
          {roleConf && RoleIcon && (
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm`}>
              <span className={`w-1.5 h-1.5 rounded-full ${roleConf.dot}`} />
              <RoleIcon size={13} className={roleConf.color} />
              <span className={`text-xs font-bold capitalize ${roleConf.color}`}>{roleConf.label}</span>
            </div>
          )}

          {/* Avatar + dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0`}>
                {initial}
              </div>
              <span className="text-xs font-semibold text-slate-700 capitalize hidden sm:block">
                {userRole}
              </span>
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {open && (
                <>
                  {/* backdrop click dismiss */}
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 420 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-20"
                  >
                    {/* User info */}
                    <div className="px-4 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-extrabold text-sm`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 capitalize">{userRole}</p>
                          <p className="text-xs text-slate-400">Current session</p>
                        </div>
                      </div>
                    </div>

                    {/* Role info row */}
                    {roleConf && RoleIcon && (
                      <div className="px-4 py-3 border-b border-slate-100">
                        <div className={`flex items-center gap-2 ${roleConf.bg} rounded-xl px-3 py-2`}>
                          <RoleIcon size={14} className={roleConf.color} />
                          <span className={`text-xs font-bold ${roleConf.color} capitalize`}>
                            {roleConf.label} Access
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Logout */}
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
