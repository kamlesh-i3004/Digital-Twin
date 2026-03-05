import React, { useEffect, useState } from 'react';
import { tasksApi, analyticsApi } from '@/services/api';
import type { TaskStats, TaskCompletionData, PriorityDistribution, ProductivityMetrics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Target,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
};

const PRIORITY_COLORS = {
  High: COLORS.danger,
  Medium: COLORS.warning,
  Low: COLORS.primary,
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, description, icon: Icon, trend = 'neutral' }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={cn(
          'p-3 rounded-xl',
          trend === 'up' && 'bg-green-100 text-green-700 dark:bg-green-900/30',
          trend === 'down' && 'bg-red-100 text-red-700 dark:bg-red-900/30',
          trend === 'neutral' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [completionData, setCompletionData] = useState<TaskCompletionData[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityDistribution[]>([]);
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      const [statsData, completion, priority, prodMetrics] = await Promise.all([
        tasksApi.getStats(),
        analyticsApi.getTaskCompletion(parseInt(timeRange)),
        analyticsApi.getPriorityDistribution(),
        analyticsApi.getProductivityMetrics(),
      ]);
      setStats(statsData);
      setCompletionData(completion);
      setPriorityData(priority);
      setMetrics(prodMetrics);
    } catch (error) {
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  // Format completion data for chart
  const formattedCompletionData = completionData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Calculate additional metrics
  const completionRate = stats ? Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;
  const pendingRate = stats ? Math.round((stats.pending / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your productivity and task completion</p>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="30">30 Days</TabsTrigger>
            <TabsTrigger value="90">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard
              title="Completion Rate"
              value={`${completionRate}%`}
              description="Tasks completed overall"
              icon={CheckCircle2}
              trend={completionRate >= 70 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Tasks/Day"
              value={metrics?.tasks_per_day.toFixed(1) || '0'}
              description="Average completion rate"
              icon={Target}
              trend="up"
            />
            <StatCard
              title="Current Streak"
              value={`${metrics?.streak_days || 0} days`}
              description="Consecutive active days"
              icon={TrendingUp}
              trend={metrics && metrics.streak_days > 3 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Pending Tasks"
              value={stats?.pending || 0}
              description={`${pendingRate}% of total tasks`}
              icon={Clock}
              trend={stats && stats.pending > stats.completed ? 'down' : 'up'}
            />
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Completion Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <CardTitle>Task Completion Over Time</CardTitle>
            </div>
            <CardDescription>Daily task creation and completion</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : completionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={formattedCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="created"
                    name="Created"
                    fill={COLORS.primary}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill={COLORS.success}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No data available for this period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              <CardTitle>Priority Distribution</CardTitle>
            </div>
            <CardDescription>Tasks by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ priority, count }) => `${priority}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="priority"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PRIORITY_COLORS[entry.priority] || COLORS.primary}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChartIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No priority data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productivity Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Productivity Trend</CardTitle>
            </div>
            <CardDescription>Your task completion trend over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : completionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={formattedCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed Tasks"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={{ fill: COLORS.success, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Created Tasks"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No trend data available for this period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity Summary</CardTitle>
          <CardDescription>Key insights about your task management</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Task Completion
                </h4>
                <p className="text-sm text-muted-foreground">
                  You've completed <span className="font-semibold text-foreground">{stats?.completed || 0}</span> tasks
                  out of <span className="font-semibold text-foreground">{stats?.total || 0}</span> total tasks.
                  {completionRate >= 70
                    ? ' Excellent work!'
                    : completionRate >= 40
                    ? ' Keep pushing!'
                    : ' Time to get started!'}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  Focus Areas
                </h4>
                <p className="text-sm text-muted-foreground">
                  {stats && stats.overdue > 0 ? (
                    <>
                      You have <span className="font-semibold text-red-500">{stats.overdue} overdue tasks</span>.
                      Prioritize these to stay on track.
                    </>
                  ) : (
                    <>Great job! You have no overdue tasks. Keep maintaining your schedule.</>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Consistency
                </h4>
                <p className="text-sm text-muted-foreground">
                  Your current streak is <span className="font-semibold text-foreground">{metrics?.streak_days || 0} days</span>.
                  {metrics && metrics.streak_days >= 7
                    ? ' Amazing consistency!'
                    : ' Build a habit by completing tasks daily.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
