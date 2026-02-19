interface NavBarProps {
  collapsed: boolean;
}

export function NavBar({ collapsed }: NavBarProps) {
  return (
    <header 
      className="fixed top-0 right-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border/60 transition-all duration-300"
      style={{ left: collapsed ? '64px' : '256px' }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Empty for now - can add search, notifications, user profile later */}
        <div className="flex-1"></div>
      </div>
    </header>
  );
}
