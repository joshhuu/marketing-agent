import { Link, useLocation } from 'react-router-dom';
import { Sparkles, History, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/', label: 'Campaign', icon: Sparkles },
  { to: '/history', label: 'History', icon: History },
  { to: '/prospects', label: 'Prospects', icon: Users },
];

export function NavBar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">
            Campaign<span className="text-gradient">AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <Link key={to} to={to} className="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors group">
                <span className={`flex items-center gap-1.5 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-accent rounded-lg"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
