import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, assistantApi } from '@/services/api';
import type { TaskStats, Task, AssistantDigest } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DailyDigestCard from '@/components/assistant/DailyDigestCard';
import { useAssistantAlerts } from '@/hooks/useAssistantAlerts';

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: number;
  description: string;
  icon: React.ElementType;
  trend?: number;
  iconBg: string;
  borderColor: string;
}> = ({ title, value, description, icon: Icon, trend, iconBg, borderColor }) => (
  <Card className={cn('card-hover border-l-4', borderColor)}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold">{value}</h3>
            {trend !== undefined && (
              <span
                className={cn(
                  'text-xs font-medium',
                  trend >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {trend >= 0 ? '+' : ''}
                {trend}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={cn('p-3 rounded-xl', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  iconBg: string;
}> = ({ title, description, icon: Icon, onClick, iconBg }) => (
  <Card
    className="cursor-pointer card-hover transition-all hover:scale-[1.02] group"
    onClick={onClick}
  >
    <CardContent className="p-5">
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-xl transition-transform group-hover:scale-110', iconBg)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </CardContent>
  </Card>
);

// ─── Main Dashboard ─────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [digest, setDigest] = useState<AssistantDigest | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fire proactive toast alerts once per session
  useAssistantAlerts(digest);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [digestData, statsData, tasksData] = await Promise.all([
        assistantApi.getDigest(),
        tasksApi.getStats(),
        tasksApi.getAll(),
      ]);
      setDigest(digestData);
      setStats(statsData);
      setRecentTasks(
        tasksData
          .filter((t) => t.status === 'pending')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const completionRate = stats
    ? Math.round((stats.completed / Math.max(stats.total, 1)) * 100)
    : 0;

  const priorityDotClass: Record<string, string> = {
    High: 'bg-destructive',
    Medium: 'bg-warning',
    Low: 'bg-info',
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Your personal assistant overview
          </p>
        </div>
        <Button onClick={() => navigate('/tasks')} className="btn-animate">
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* ── Daily Digest Card (assistant core) ── */}
      <DailyDigestCard
        digest={digest}
        isLoading={isLoading}
        userName={user?.name}
        onTaskCompleted={fetchDashboardData}
      />

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Tasks"
              value={stats?.total || 0}
              description="All your tasks"
              icon={ListTodo}
              iconBg="bg-info"
              borderColor="border-l-info"
            />
            <StatCard
              title="Completed Today"
              value={stats?.completed_today || 0}
              description="Tasks finished today"
              icon={CheckCircle2}
              iconBg="bg-success"
              borderColor="border-l-success"
            />
            <StatCard
              title="Pending"
              value={stats?.pending || 0}
              description="Tasks waiting"
              icon={Clock}
              iconBg="bg-warning"
              borderColor="border-l-warning"
            />
            <StatCard
              title="Overdue"
              value={stats?.overdue || 0}
              description="Past due date"
              icon={AlertCircle}
              iconBg="bg-destructive"
              borderColor="border-l-destructive"
            />
          </>
        )}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column – Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickActionCard
                title="Add New Task"
                description="Create a task with priority and due date"
                icon={Plus}
                onClick={() => navigate('/tasks')}
                iconBg="bg-info"
              />
              <QuickActionCard
                title="Write Note"
                description="Jot down your thoughts and ideas"
                icon={FileText}
                onClick={() => navigate('/notes')}
                iconBg="bg-primary"
              />
              <QuickActionCard
                title="View Analytics"
                description="See your productivity metrics"
                icon={TrendingUp}
                onClick={() => navigate('/analytics')}
                iconBg="bg-success"
              />
              <QuickActionCard
                title="Manage Tasks"
                description="View and organize all your tasks"
                icon={ListTodo}
                onClick={() => navigate('/tasks')}
                iconBg="bg-warning"
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Completion Progress */}
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-lg">Completion Rate</CardTitle>
              <CardDescription>Your task completion progress</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{completionRate}%</span>
                    <Badge variant={completionRate >= 70 ? 'default' : 'secondary'}>
                      {completionRate >= 70 ? 'Great!' : 'Keep Going'}
                    </Badge>
                  </div>
                  <Progress value={completionRate} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {stats?.completed} of {stats?.total} tasks completed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Tasks</CardTitle>
                <CardDescription>Your latest pending tasks</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : recentTasks.length > 0 ? (
                <div className="space-y-2">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate('/tasks')}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          priorityDotClass[task.priority] ?? 'bg-muted-foreground'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.due_date
                            ? `Due ${new Date(task.due_date).toLocaleDateString()}`
                            : 'No due date'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No pending tasks</p>
                  <Button variant="link" size="sm" onClick={() => navigate('/tasks')}>
                    Create your first task
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
