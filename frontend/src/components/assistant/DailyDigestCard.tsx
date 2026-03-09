import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssistantDigest } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Calendar,
  Flame,
  CheckCircle2,
  Zap,
  ArrowRight,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tasksApi } from '@/services/api';
import { toast } from 'sonner';

interface DailyDigestCardProps {
  digest: AssistantDigest | null;
  isLoading: boolean;
  userName?: string;
  onTaskCompleted?: () => void;
}

const DailyDigestCard: React.FC<DailyDigestCardProps> = ({
  digest,
  isLoading,
  userName,
  onTaskCompleted,
}) => {
  const navigate = useNavigate();
  const [isMarkingDone, setIsMarkingDone] = React.useState(false);

  const handleMarkDone = async () => {
    if (!digest?.focus_task?.task) return;
    setIsMarkingDone(true);
    try {
      await tasksApi.update(digest.focus_task.task.id, { status: 'completed' });
      toast.success('Task completed! ✅');
      onTaskCompleted?.();
    } catch {
      toast.error('Failed to mark task as done');
    } finally {
      setIsMarkingDone(false);
    }
  };

  const now = new Date();
  const today = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!digest) return null;

  const hasAlerts =
    digest.overdue_count > 0 ||
    digest.due_today_count > 0 ||
    digest.high_priority_pending > 0;

  const allCaughtUp =
    digest.overdue_count === 0 &&
    digest.due_today_count === 0 &&
    digest.high_priority_pending === 0;

  return (
    <Card
      className={cn(
        'border-l-4 transition-all',
        digest.overdue_count > 0
          ? 'border-l-destructive bg-gradient-to-r from-destructive/5 to-transparent'
          : digest.due_today_count > 0
          ? 'border-l-warning bg-gradient-to-r from-warning/5 to-transparent'
          : 'border-l-primary bg-gradient-to-r from-primary/5 to-transparent'
      )}
    >
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">
                {greeting}
                {userName ? `, ${userName.split(' ')[0]}!` : '!'}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
          </div>
          {digest.streak_days > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-semibold">
              <Flame className="w-4 h-4" />
              {digest.streak_days} day streak
            </div>
          )}
        </div>

        {/* Alert Badges */}
        {hasAlerts && (
          <div className="flex flex-wrap gap-2">
            {digest.overdue_count > 0 && (
              <Badge
                variant="destructive"
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium cursor-pointer hover:opacity-80"
                onClick={() => navigate('/tasks')}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {digest.overdue_count} overdue
              </Badge>
            )}
            {digest.due_today_count > 0 && (
              <Badge
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600 cursor-pointer"
                onClick={() => navigate('/tasks')}
              >
                <Calendar className="w-3.5 h-3.5" />
                {digest.due_today_count} due today
              </Badge>
            )}
            {digest.high_priority_pending > 0 && (
              <Badge
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-orange-500 hover:bg-orange-600 cursor-pointer"
                onClick={() => navigate('/tasks')}
              >
                <Zap className="w-3.5 h-3.5" />
                {digest.high_priority_pending} high priority
              </Badge>
            )}
          </div>
        )}

        {/* All caught up message */}
        {allCaughtUp && (
          <div className="flex items-center gap-2 text-success">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">
              You're all caught up! No overdue or urgent tasks. 🎉
            </span>
          </div>
        )}

        {/* Yesterday's win */}
        {digest.completed_yesterday > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>
              You completed{' '}
              <span className="font-semibold text-foreground">
                {digest.completed_yesterday} task
                {digest.completed_yesterday > 1 ? 's' : ''}
              </span>{' '}
              yesterday — great work!
            </span>
          </div>
        )}

        {/* Focus Task */}
        {digest.focus_task && (
          <div className="bg-background/60 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Focus Task
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug truncate">
                  {digest.focus_task.task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={
                      digest.focus_task.task.priority === 'High'
                        ? 'destructive'
                        : digest.focus_task.task.priority === 'Medium'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-xs px-2 py-0"
                  >
                    {digest.focus_task.task.priority}
                  </Badge>
                  {digest.focus_task.task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {digest.focus_task.task.due_date}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {digest.focus_task.reason}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs"
                  onClick={handleMarkDone}
                  disabled={isMarkingDone}
                >
                  {isMarkingDone ? (
                    <span className="flex items-center gap-1">
                      <span className="animate-spin rounded-full h-3 w-3 border-b border-white" />
                      Saving…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Done
                    </span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => navigate('/tasks')}
                >
                  <span className="flex items-center gap-1">
                    View
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming tasks mini-list */}
        {digest.upcoming_tasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Coming up
            </p>
            <div className="space-y-1">
              {digest.upcoming_tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate('/tasks')}
                >
                  <span className="truncate text-foreground/80">{task.title}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      variant={
                        task.priority === 'High'
                          ? 'destructive'
                          : task.priority === 'Medium'
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs px-1.5 py-0"
                    >
                      {task.priority}
                    </Badge>
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {task.due_date}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyDigestCard;
