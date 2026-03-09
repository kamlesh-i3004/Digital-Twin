import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ArrowLeft,
  Code2,
  Server,
  Brain,
  CheckSquare,
  FileText,
  BarChart3,
  Shield,
  Layers,
  GitBranch,
  Globe,
  Sparkles,
  Mail,
  Sun,
  Moon,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const techStack = {
  frontend: [
    { name: 'React 19 + Vite', desc: 'Fast build tooling with latest React' },
    { name: 'TypeScript', desc: 'Type-safe development' },
    { name: 'Tailwind CSS', desc: 'Utility-first styling' },
    { name: 'shadcn/ui + Radix UI', desc: 'Accessible component library' },
    { name: 'React Router v6', desc: 'Client-side routing' },
    { name: 'Axios', desc: 'HTTP client with interceptors' },
  ],
  backend: [
    { name: 'Flask 2.0+', desc: 'Lightweight Python web framework' },
    { name: 'SQLAlchemy', desc: 'ORM for database operations' },
    { name: 'MySQL (PyMySQL)', desc: 'Relational database' },
    { name: 'Flask-JWT-Extended', desc: 'Secure JWT authentication' },
    { name: 'Flask-Limiter', desc: 'Per-endpoint rate limiting' },
    { name: 'Google OAuth 2.0', desc: 'Gmail & Calendar integration' },
  ],
  ai: [
    { name: 'Groq API (Llama 3.1 8B)', desc: 'Fast LLM inference for email-to-task extraction' },
    { name: 'Gmail API', desc: 'Fetch and parse emails automatically' },
    { name: 'Question Cache (TTL)', desc: 'LLM response caching to reduce API calls' },
    { name: 'Exponential Backoff', desc: 'Resilient polling for async sync jobs' },
  ],
};

const features = [
  {
    icon: CheckSquare,
    title: 'Smart Task Management',
    desc: 'Create, prioritize, and track tasks with due dates and categories. AI recommends what to focus on.',
  },
  {
    icon: FileText,
    title: 'Rich Notes',
    desc: 'Capture thoughts and ideas in a clean note-taking system, organized alongside your tasks.',
  },
  {
    icon: BarChart3,
    title: 'Productivity Analytics',
    desc: 'Completion trends, streak tracking, and performance charts to understand your work patterns.',
  },
  {
    icon: Sparkles,
    title: 'AI Daily Digest',
    desc: 'Morning briefing with overdue counts, upcoming tasks, and AI-generated focus recommendations.',
  },
  {
    icon: Mail,
    title: 'Gmail Sync',
    desc: 'Automatically extract actionable tasks from your emails using LLM-powered parsing.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'JWT authentication, per-user data isolation, rate limiting, and encrypted storage.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    desc: 'Vite-powered frontend, optimized DB queries with indexes, and in-memory rate limiting.',
  },
  {
    icon: GitBranch,
    title: 'Weekly Email Digest',
    desc: 'Scheduled weekly productivity summary sent directly to your inbox.',
  },
];

const architecture = [
  {
    layer: 'Presentation Layer',
    components: ['React 19 Pages', 'shadcn/ui Components', 'Tailwind CSS', 'AuthContext + ThemeContext'],
  },
  {
    layer: 'API Layer',
    components: ['Flask Blueprints', 'JWT Middleware', 'Flask-Limiter', 'CORS Handling'],
  },
  {
    layer: 'Business Logic',
    components: ['Task Service', 'AI Extraction', 'Gmail OAuth Sync', 'Digest Scheduler'],
  },
  {
    layer: 'Data Layer',
    components: ['MySQL Database', 'SQLAlchemy ORM', 'DB Indexes', 'Soft Delete'],
  },
];

const dataFlow = [
  { text: 'Email arrives in Gmail', highlight: true },
  { text: '→', arrow: true },
  { text: 'OAuth fetch via Gmail API' },
  { text: '→', arrow: true },
  { text: 'Groq LLM parses content' },
  { text: '→', arrow: true },
  { text: 'Task extracted & deduped' },
  { text: '→', arrow: true },
  { text: 'Saved to MySQL' },
  { text: '→', arrow: true },
  { text: 'Shown in dashboard', success: true },
];

const futureScope = [
  'Calendar integration — auto-schedule tasks from Google Calendar events',
  'Mobile app (React Native) for on-the-go task capture',
  'Slack / WhatsApp integration for task creation via messages',
  'Team workspaces with shared tasks and collaboration',
  'Voice input — speak a task and let AI parse it',
  'Smart reminders based on productivity patterns',
  'Offline mode with background sync',
  'Export data to CSV / Notion / Todoist',
];

const DeveloperAvatar: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/profile.jpg"
        alt="Alka Dubey"
        onError={() => setImgError(true)}
        className="w-24 h-24 rounded-full object-cover object-center flex-shrink-0 border-2 border-primary/20"
      />
    );
  }

  return (
    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
      <span className="text-2xl font-bold text-primary">AD</span>
    </div>
  );
};

const About: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">Digital Twin</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Final Year Blackbook Project
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Digital Twin
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            An AI-powered personal productivity assistant that manages tasks, syncs emails,
            and delivers intelligent daily insights — all completely free.
          </p>
        </div>

        {/* Project Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Globe className="w-6 h-6 text-primary" />
            Project Overview
          </h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Digital Twin</strong> is a full-stack productivity
                platform built to act as an intelligent second brain. The core idea: your digital twin
                knows your tasks, reads your emails, tracks your streaks, and tells you what to do next.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The platform addresses a common problem — context-switching between email, task managers,
                and calendars. Digital Twin centralizes everything: Gmail sync extracts tasks from emails
                automatically using an LLM, analytics surface productivity patterns, and an AI daily
                digest gives you a smart briefing every morning.
              </p>
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                {[
                  { label: 'AI-Powered', sub: 'LLM email extraction + recommendations' },
                  { label: '100% Free', sub: 'No paid services or APIs' },
                  { label: 'Full-Stack', sub: 'React + Flask + MySQL' },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-muted text-center">
                    <p className="text-xl font-bold text-primary">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.sub}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tech Stack */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Code2 className="w-6 h-6 text-primary" />
            Technology Stack
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">Frontend</h3>
                </div>
                <ul className="space-y-3">
                  {techStack.frontend.map((tech) => (
                    <li key={tech.name} className="text-sm">
                      <span className="font-semibold">{tech.name}</span>
                      <span className="text-muted-foreground"> — {tech.desc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-green-500/10 text-green-500">
                    <Server className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">Backend</h3>
                </div>
                <ul className="space-y-3">
                  {techStack.backend.map((tech) => (
                    <li key={tech.name} className="text-sm">
                      <span className="font-semibold">{tech.name}</span>
                      <span className="text-muted-foreground"> — {tech.desc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500">
                    <Brain className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">AI & Integrations</h3>
                </div>
                <ul className="space-y-3">
                  {techStack.ai.map((tech) => (
                    <li key={tech.name} className="text-sm">
                      <span className="font-semibold">{tech.name}</span>
                      <span className="text-muted-foreground"> — {tech.desc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* System Architecture */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Layers className="w-6 h-6 text-primary" />
            System Architecture
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {architecture.map((layer, idx) => (
                  <div
                    key={layer.layer}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-muted"
                  >
                    <div className="md:w-48 flex-shrink-0">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Layer {idx + 1}
                      </span>
                      <p className="font-bold">{layer.layer}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {layer.components.map((comp) => (
                        <span
                          key={comp}
                          className="px-3 py-1.5 rounded-lg text-sm bg-background border"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Flow */}
              <div className="mt-8 p-5 rounded-xl bg-muted">
                <h4 className="font-bold mb-4">Gmail Sync Data Flow</h4>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {dataFlow.map((item, i) =>
                    item.arrow ? (
                      <ArrowRight key={i} className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <span
                        key={i}
                        className={cn(
                          'px-3 py-1.5 rounded-lg',
                          item.highlight
                            ? 'bg-primary/10 text-primary font-medium'
                            : item.success
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 font-medium'
                            : 'bg-background border'
                        )}
                      >
                        {item.text}
                      </span>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Key Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            Key Features
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Future Scope */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <GitBranch className="w-6 h-6 text-primary" />
            Future Scope
          </h2>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-6">
                Designed with extensibility in mind. Potential enhancements include:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {futureScope.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                  >
                    <span className="text-primary font-bold flex-shrink-0">{idx + 1}.</span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Developer */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Code2 className="w-6 h-6 text-primary" />
            Developer
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <DeveloperAvatar />
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-bold">Alka Dubey</h3>
                  <p className="text-muted-foreground mb-3">Third Year Data Science Student</p>
                  <p className="text-sm text-muted-foreground max-w-lg">
                    This project was developed as a final year blackbook submission, demonstrating
                    full-stack development skills across React, Flask, MySQL, and AI integration
                    using modern web development practices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-6">Ready to try it?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/register">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
