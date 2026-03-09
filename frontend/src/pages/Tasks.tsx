import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { tasksApi, integrationsApi } from '@/services/api';
import type { Task, TaskFilters, TaskPriority } from '@/types';
import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  ArrowUpDown,
  X,
  Clock,
  CheckCircle,
  CalendarPlus,
  MousePointer,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const priorityColors: Record<TaskPriority, string> = {
  Low: 'bg-info/10 text-info border-info/20',
  Medium: 'bg-warning/10 text-warning-foreground border-warning/20',
  High: 'bg-destructive/10 text-destructive border-destructive/20',
};

// ─── Assistant Sort ────────────────────────────────────────────────────────────
type AssistantTier = 1 | 2 | 3 | 4 | 5 | 6;

function getAssistantTier(task: Task): AssistantTier {
  if (task.status === 'completed') return 6;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const in3Days = new Date(today.getTime() + 3 * 86_400_000);
  const in7Days = new Date(today.getTime() + 7 * 86_400_000);
  const due = task.due_date ? new Date(task.due_date) : null;

  if (due && due < today) return 1;                                    // overdue
  if (due && due < tomorrow) return 2;                                 // due today
  if (task.priority === 'High' && due && due < in3Days) return 3;     // high + due soon
  if (due && due < in7Days) return 4;                                  // due this week
  return 5;                                                            // everything else
}

function assistantSort(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const tierDiff = getAssistantTier(a) - getAssistantTier(b);
    if (tierDiff !== 0) return tierDiff;
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return aDate - bDate;
  });
}

/** Returns Tailwind left-border class based on urgency tier */
function getTierBorderClass(task: Task): string {
  const tier = getAssistantTier(task);
  switch (tier) {
    case 1: return 'border-l-4 border-l-destructive';   // overdue – red
    case 2: return 'border-l-4 border-l-amber-500';     // due today – amber
    case 3: return 'border-l-4 border-l-orange-400';    // high + due soon – orange
    case 4: return 'border-l-4 border-l-blue-400';      // this week – blue
    default: return '';
  }
}

const statusColors = {
  pending: 'bg-warning/10 text-warning-foreground',
  completed: 'bg-success/10 text-success',
};

const TaskForm: React.FC<{
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => void;
}> = ({ task, isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    priority: 'Medium',
    due_date: new Date().toISOString().split('T')[0],
    category: 'Personal',
    status: 'pending',
  });
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        category: task.category,
        status: task.status,
      });
      setDate(new Date(task.due_date));
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'Medium',
        due_date: new Date().toISOString().split('T')[0],
        category: 'Personal',
        status: 'pending',
      });
      setDate(new Date());
    }
  }, [task, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      toast.error('Title is required');
      return;
    }
    onSubmit(formData);
    onClose();
  };

  const categories = ['Personal', 'Work', 'Jobs', 'Shopping', 'Health', 'Finance', 'Education', 'Government', 'Other'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add task details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: TaskPriority) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    if (d) {
                      setFormData({ ...formData, due_date: d.toISOString().split('T')[0] });
                    }
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {task ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle: string;
}> = ({ isOpen, onClose, onConfirm, taskTitle }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete Task</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <p className="text-muted-foreground">
          Are you sure you want to delete "<span className="font-medium text-foreground">{taskTitle}</span>"?
        </p>
        <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// ─── Task Detail Sheet ──────────────────────────────────────────────────────
const TaskDetailSheet: React.FC<{
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onDelete: (task: Task) => void;
}> = ({ task, onClose, onEdit, onToggleStatus, onDelete }) => {
  if (!task) return null;

  const priorityStyle: Record<string, string> = {
    High: 'bg-destructive/10 text-destructive border-destructive/20',
    Medium: 'bg-warning/10 text-warning-foreground border-warning/20',
    Low: 'bg-info/10 text-info border-info/20',
  };

  return (
    <Sheet open={!!task} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3 pr-6">
            <div className={cn(
              'mt-0.5 w-3 h-3 rounded-full flex-shrink-0',
              task.status === 'completed' ? 'bg-success' : 'bg-primary'
            )} />
            <SheetTitle className={cn(
              'text-left text-lg leading-snug',
              task.status === 'completed' && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="pt-5 space-y-5">
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={priorityStyle[task.priority]} variant="outline">
              {task.priority} Priority
            </Badge>
            <Badge variant="secondary">{task.category}</Badge>
            <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
              {task.status === 'completed' ? '✓ Completed' : 'Pending'}
            </Badge>
            {task.source_email_id && (
              <Badge variant="outline" className="border-blue-400 text-blue-500">
                Gmail
              </Badge>
            )}
            {task.calendar_event_id && (
              <Badge variant="outline" className="border-green-500 text-green-600">
                On Calendar
              </Badge>
            )}
          </div>

          {/* Due date */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="w-4 h-4 flex-shrink-0" />
              <span>Due {new Date(task.due_date).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}</span>
            </div>
          )}

          {/* Full description / email content */}
          {task.description ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {task.source_email_id ? 'Email Content' : 'Description'}
              </p>
              <div className="bg-muted rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {task.description}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description added.</p>
          )}

          {/* Created at */}
          <p className="text-xs text-muted-foreground">
            Created {new Date(task.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onClose(); onEdit(task); }}
            >
              <Edit2 className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onToggleStatus(task); onClose(); }}
            >
              {task.status === 'pending' ? (
                <><CheckCircle className="w-4 h-4 mr-1.5" />Mark Complete</>
              ) : (
                <><Circle className="w-4 h-4 mr-1.5" />Reopen</>
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { onClose(); onDelete(task); }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    category: 'all',
    search: '',
    sortBy: 'assistant' as TaskFilters['sortBy'],
    sortOrder: 'asc',
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      if (!taskData.title || !taskData.priority) {
        toast.error('Missing required task fields');
        return;
      }
      await tasksApi.create(taskData as Omit<Task, 'id' | 'created_at'>);
      toast.success('Task created successfully');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!editingTask) return;
    try {
      await tasksApi.update(editingTask.id, taskData);
      toast.success('Task updated successfully');
      fetchTasks();
      setEditingTask(null);
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await tasksApi.delete(deletingTask.id);
      toast.success('Task deleted successfully');
      fetchTasks();
      setDeletingTask(null);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    try {
      await tasksApi.update(task.id, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
      });
      toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const [calendarLoadingId, setCalendarLoadingId] = useState<string | null>(null);

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(tasks.filter(t =>
    (filters.status === 'all' || t.status === filters.status) &&
    (filters.priority === 'all' || t.priority === filters.priority) &&
    (filters.category === 'all' || t.category === filters.category)
  ).map((t) => t.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkAction = async (action: 'complete' | 'reopen' | 'delete') => {
    if (selectedIds.size === 0) return;
    try {
      const result = await tasksApi.bulkAction(action, Array.from(selectedIds));
      toast.success(`${result.affected} task${result.affected !== 1 ? 's' : ''} ${action === 'delete' ? 'deleted' : action === 'complete' ? 'completed' : 'reopened'}`);
      exitSelectionMode();
      fetchTasks();
    } catch {
      toast.error(`Bulk ${action} failed`);
    }
  };

  const handlePushToCalendar = async (task: Task) => {
    if (!task.due_date) {
      toast.error('Set a due date before adding to calendar');
      return;
    }
    setCalendarLoadingId(task.id);
    try {
      await integrationsApi.pushTaskToCalendar(task.id);
      toast.success('Added to Google Calendar');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg?.includes('not connected')) {
        toast.error('Connect Google in Settings first');
      } else {
        toast.error(msg || 'Failed to add to calendar');
      }
    } finally {
      setCalendarLoadingId(null);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status);
    }

    // Filter by priority
    if (filters.priority !== 'all') {
      result = result.filter((t) => t.priority === filters.priority);
    }

    // Filter by category
    if (filters.category !== 'all') {
      result = result.filter((t) => t.category === filters.category);
    }

    // Search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    if ((filters.sortBy as string) === 'assistant') {
      result = assistantSort(result);
    } else {
      result.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'due_date': {
            const aTime = a.due_date ? new Date(a.due_date).getTime() : Infinity;
            const bTime = b.due_date ? new Date(b.due_date).getTime() : Infinity;
            comparison = aTime - bTime;
            break;
          }
          case 'priority': {
            const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
          }
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
        }
        return filters.sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [tasks, filters]);

  const categories = useMemo(() => {
    const cats = new Set(tasks.map((t) => t.category));
    return ['all', ...Array.from(cats)];
  }, [tasks]);

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      category: 'all',
      search: '',
      sortBy: 'assistant' as TaskFilters['sortBy'],
      sortOrder: 'asc',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Manage your tasks and stay organized</p>
        </div>
        <div className="flex gap-2">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
              <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setSelectionMode(true)}>
                <MousePointer className="w-4 h-4 mr-2" />
                Select
              </Button>
              <Button className="btn-animate" onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? 'bg-accent' : ''}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value: any) => setFilters({ ...filters, sortBy: value })}
                >
                  <SelectTrigger className="w-[160px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assistant">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        Assistant
                      </span>
                    </SelectItem>
                    <SelectItem value="due_date">Due Date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="created_at">Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-3 border-t">
                <Tabs
                  value={filters.status}
                  onValueChange={(v) => setFilters({ ...filters, status: v as any })}
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>

                <Select
                  value={filters.priority}
                  onValueChange={(v) => setFilters({ ...filters, priority: v as any })}
                >
                  <SelectTrigger className="w-[130px]">
                    <span className="text-muted-foreground">Priority:</span>
                    <span className="ml-1">{filters.priority === 'all' ? 'All' : filters.priority}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilters({ ...filters, category: v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-1">{filters.category === 'all' ? 'All' : filters.category}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))
        ) : filteredTasks.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                {tasks.length === 0
                  ? "You haven't created any tasks yet."
                  : 'No tasks match your current filters.'}
              </p>
              {tasks.length === 0 ? (
                <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first task
                </Button>
              ) : (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={cn(
                'group card-hover transition-all',
                task.status === 'completed' ? 'opacity-60' : getTierBorderClass(task),
                selectionMode && selectedIds.has(task.id) && 'ring-2 ring-primary'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {selectionMode ? (
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleSelect(task.id)}
                      className="mt-1"
                      aria-label={`Select ${task.title}`}
                    />
                  ) : (
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => handleToggleStatus(task)}
                      className="mt-1"
                      aria-label={`Mark ${task.title} as ${task.status === 'completed' ? 'pending' : 'completed'}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => !selectionMode && setViewingTask(task)}
                      >
                        <h4 className={cn(
                          'font-medium truncate',
                          task.status === 'completed' && 'line-through text-muted-foreground'
                        )}>
                          {task.title}
                        </h4>
                        <p className={cn(
                          'text-sm text-muted-foreground line-clamp-2 mt-1',
                          task.status === 'completed' && 'line-through'
                        )}>
                          {task.description}
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColors[task.priority]} variant="outline">
                          {task.priority}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Task actions">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => { setEditingTask(task); setIsFormOpen(true); }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(task)}
                            >
                              {task.status === 'pending' ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </>
                              ) : (
                                <>
                                  <Circle className="w-4 h-4 mr-2" />
                                  Reopen
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePushToCalendar(task)}
                              disabled={calendarLoadingId === task.id}
                            >
                              <CalendarPlus className="w-4 h-4 mr-2" />
                              {calendarLoadingId === task.id ? 'Adding...' : 'Add to Calendar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingTask(task)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString()
                          : 'No due date'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.category}
                      </span>
                      <Badge className={statusColors[task.status]} variant="secondary">
                        {task.status}
                      </Badge>
                      {task.source_email_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-500">
                          Gmail
                        </Badge>
                      )}
                      {task.calendar_event_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-600">
                          On Calendar
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-full px-5 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('complete')}>
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Complete
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction('reopen')}>
            <Circle className="w-4 h-4 mr-1.5" />
            Reopen
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Task Form Dialog */}
      <TaskForm
        task={editingTask}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteTask}
        taskTitle={deletingTask?.title || ''}
      />

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={viewingTask}
        onClose={() => setViewingTask(null)}
        onEdit={(task) => { setEditingTask(task); setIsFormOpen(true); }}
        onToggleStatus={handleToggleStatus}
        onDelete={(task) => setDeletingTask(task)}
      />
    </div>
  );
};

export default Tasks;
