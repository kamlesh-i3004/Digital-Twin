import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  CheckSquare,
  FileText,
  BarChart3,
  Sparkles,
  Shield,
  Zap,
  Clock,
  Target,
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  CheckCircle2,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: CheckSquare,
    title: 'Smart Task Management',
    description: 'Organize tasks with priorities, due dates, and categories. Get AI-powered recommendations on what to focus on next.',
    color: 'bg-blue-500',
  },
  {
    icon: FileText,
    title: 'Rich Notes',
    description: 'Capture your thoughts, ideas, and important information in a clean, organized note-taking system.',
    color: 'bg-purple-500',
  },
  {
    icon: BarChart3,
    title: 'Productivity Analytics',
    description: 'Track your progress with beautiful charts and insights. Understand your productivity patterns.',
    color: 'bg-green-500',
  },
  {
    icon: Sparkles,
    title: 'AI Recommendations',
    description: 'Get intelligent suggestions on which tasks to prioritize based on deadlines and importance.',
    color: 'bg-amber-500',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data is encrypted and isolated. Each user has their own secure workspace.',
    color: 'bg-red-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Built with modern technology for a smooth, responsive experience across all devices.',
    color: 'bg-cyan-500',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Create Your Account',
    description: 'Sign up in seconds and set up your personal workspace. No credit card required.',
    icon: CheckCircle2,
  },
  {
    step: '02',
    title: 'Add Your Tasks',
    description: 'Start adding tasks with priorities, due dates, and categories. Organize your work effortlessly.',
    icon: CheckSquare,
  },
  {
    step: '03',
    title: 'Get AI Insights',
    description: 'Receive smart recommendations and track your productivity with detailed analytics.',
    icon: Sparkles,
  },
];

const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-background/80 backdrop-blur-lg border-b shadow-sm'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">Digital Twin</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                How It Works
              </button>
              <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hidden sm:flex"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>

              {isAuthenticated ? (
                <Button asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="ghost" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Get Started</Link>
                  </Button>
                </div>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-b">
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => scrollToSection('features')}
                className="block w-full text-left py-2 text-sm font-medium"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="block w-full text-left py-2 text-sm font-medium"
              >
                How It Works
              </button>
              <Link to="/about" className="block py-2 text-sm font-medium">About</Link>
              <Separator />
              {!isAuthenticated && (
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button className="w-full" asChild>
                    <Link to="/register">Get Started</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-Powered Productivity
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Your Personal
              <span className="text-primary"> Digital Twin</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The intelligent assistant that helps you manage tasks, capture ideas, and boost productivity with AI-powered insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link to="/register">
                      Get Started Free
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                    <Link to="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Free forever. No credit card required.
            </p>
          </div>
        </div>

        {/* Hero Value Props */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { icon: CheckSquare, label: 'Smart Task Management' },
              { icon: Sparkles, label: 'AI-Powered Insights' },
              { icon: BarChart3, label: 'Productivity Analytics' },
              { icon: Shield, label: 'Secure & Private' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Stay Productive
            </h2>
            <p className="text-muted-foreground">
              Powerful features designed to help you organize, prioritize, and accomplish more every day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', feature.color)}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 lg:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Get Started in Three Simple Steps
            </h2>
            <p className="text-muted-foreground">
              Digital Twin is designed to be intuitive and easy to use. Start being more productive today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 items-stretch gap-6">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative flex">
                <div className="bg-card rounded-2xl p-8 border shadow-sm hover:shadow-md transition-shadow flex flex-col w-full">
                  <div className="text-5xl font-bold text-primary/20 mb-4">{item.step}</div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border shadow-sm items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5 text-primary/60" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Preview Section */}
      <section className="py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Preview</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Beautiful, Intuitive Interface
            </h2>
            <p className="text-muted-foreground">
              Experience a clean, modern design that makes task management a pleasure.
            </p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard" className="mt-0">
              <div className="relative rounded-2xl overflow-hidden border shadow-2xl bg-card">
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Tasks', value: '24', icon: CheckSquare, color: 'bg-blue-500' },
                      { label: 'Completed', value: '18', icon: CheckCircle2, color: 'bg-green-500' },
                      { label: 'Pending', value: '6', icon: Clock, color: 'bg-yellow-500' },
                      { label: 'Overdue', value: '0', icon: Target, color: 'bg-red-500' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-card border rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="text-2xl font-bold">{stat.value}</p>
                          </div>
                          <div className={cn('p-2 rounded-lg', stat.color)}>
                            <stat.icon className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-primary">AI Recommendation</p>
                        <p className="text-sm text-muted-foreground">Focus on your high-priority task due tomorrow</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <div className="relative rounded-2xl overflow-hidden border shadow-2xl bg-card">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="relative flex-1 max-w-md">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-muted-foreground/30 rounded-full" />
                      </div>
                      <div className="h-10 bg-muted rounded-lg pl-10 flex items-center text-muted-foreground text-sm">
                        Search tasks...
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <div className="h-10 px-4 bg-muted rounded-lg flex items-center text-sm">Filter</div>
                      <div className="h-10 px-4 bg-primary text-primary-foreground rounded-lg flex items-center text-sm">
                        + New Task
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { title: 'Complete project proposal', priority: 'High', status: 'pending' },
                      { title: 'Review team updates', priority: 'Medium', status: 'completed' },
                      { title: 'Prepare presentation slides', priority: 'High', status: 'pending' },
                    ].map((task, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                        <div className={cn(
                          'w-4 h-4 rounded border-2',
                          task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-muted-foreground'
                        )} />
                        <span className={cn('flex-1', task.status === 'completed' && 'line-through text-muted-foreground')}>
                          {task.title}
                        </span>
                        <span className={cn(
                          'px-2 py-1 rounded text-xs',
                          task.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        )}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="analytics" className="mt-0">
              <div className="relative rounded-2xl overflow-hidden border shadow-2xl bg-card">
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-xl p-4">
                      <p className="text-sm font-medium mb-4">Task Completion</p>
                      <div className="h-32 flex items-end gap-2">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                          <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }}>
                            <div className="w-full bg-primary rounded-t" style={{ height: `${h * 0.6}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border rounded-xl p-4">
                      <p className="text-sm font-medium mb-4">Priority Distribution</p>
                      <div className="flex items-center justify-center h-32">
                        <div className="relative w-24 h-24">
                          <div className="absolute inset-0 rounded-full border-8 border-red-500" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 50%, 0 50%)' }} />
                          <div className="absolute inset-0 rounded-full border-8 border-yellow-500" style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 50%, 50% 50%)' }} />
                          <div className="absolute inset-0 rounded-full border-8 border-blue-500" style={{ clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-primary text-primary-foreground p-8 sm:p-16">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative text-center max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Boost Your Productivity?
              </h2>
              <p className="text-primary-foreground/80 mb-8">
                Start managing your tasks smarter with AI-powered insights.
                Free forever, no strings attached.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isAuthenticated ? (
                  <Button size="lg" variant="secondary" asChild>
                    <Link to="/dashboard">
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" variant="secondary" asChild>
                      <Link to="/register">
                        Get Started Free
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                      <Link to="/login">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold">Digital Twin</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                AI-powered personal assistant for better productivity.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-foreground">Features</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-foreground">How It Works</button></li>
                <li><Link to="/about" className="hover:text-foreground">About</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Account</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-foreground">Create Account</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Digital Twin. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
