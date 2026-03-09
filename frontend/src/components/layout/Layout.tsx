import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  Brain,
  ChevronDown,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hash: '' },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, hash: '' },
  { path: '/notes', label: 'Notes', icon: FileText, hash: '' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, hash: '' },
  { path: '/settings', label: 'Settings', icon: Settings, hash: '' },
  { path: '/settings', label: 'Integrations', icon: Link2, hash: '#integrations' },
];

const Sidebar: React.FC<{ className?: string; onItemClick?: () => void }> = ({
  className,
  onItemClick
}) => {
  const location = useLocation();

  return (
    <div className={cn("flex flex-col h-full bg-card border-r", className)}>
      {/* Logo */}
      <div className="p-6 border-b">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Digital Twin</h1>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.hash
            ? location.pathname === item.path && location.hash === item.hash
            : location.pathname === item.path && location.hash !== '#integrations';
          return (
            <NavLink
              key={item.label}
              to={item.hash ? `${item.path}${item.hash}` : item.path}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          © 2024 Digital Twin
        </p>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      {/* Mobile Menu */}
      <div className="lg:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar onItemClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Page Title - Hidden on mobile */}
      <div className="hidden lg:block">
        <h2 className="text-lg font-semibold">Welcome back, {user?.name?.split(' ')[0] || 'User'}!</h2>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user?.name ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink to="/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed h-full">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="w-full lg:ml-64 lg:w-[calc(100%-16rem)] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
