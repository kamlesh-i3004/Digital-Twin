// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Task Types
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  due_date: string;
  category: string;
  status: TaskStatus;
  created_at: string;
  completed_at?: string;
  source_email_id?: string | null;    // non-null = imported from Gmail
  calendar_event_id?: string | null;  // non-null = already synced to Google Calendar
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completed_today: number;
}

export interface TaskRecommendation {
  task: Task;
  reason: string;
}

// Note Types
export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Analytics Types
export interface TaskCompletionData {
  date: string;
  completed: number;
  created: number;
}

export interface PriorityDistribution {
  priority: TaskPriority;
  count: number;
}

export interface ProductivityMetrics {
  completion_rate: number;
  tasks_per_day: number;
  streak_days: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Integration Types
export interface GoogleIntegrationStatus {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
}

export interface GmailSender {
  email: string;
  added_at: string;
}

export interface GmailSyncResult {
  created: number;
  skipped: number;
  tasks: Task[];
}

export interface GmailSyncStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  result?: GmailSyncResult | null;
  error?: string | null;
  started_at?: string | null;
}

export interface CalendarSyncResult {
  synced: number;
}

export interface BulkTaskResult {
  affected: number;
}

export interface DigestSettings {
  enabled: boolean;
  digest_email: string | null;
  last_sent: string | null;
}

// Filter Types
export interface TaskFilters {
  status: 'all' | 'pending' | 'completed';
  priority: 'all' | TaskPriority;
  category: string;
  search: string;
  sortBy: 'assistant' | 'due_date' | 'priority' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

// Assistant Types
export interface AssistantDigest {
  greeting: string;
  overdue_count: number;
  due_today_count: number;
  due_tomorrow_count: number;
  high_priority_pending: number;
  completed_yesterday: number;
  streak_days: number;
  focus_task: TaskRecommendation | null;
  upcoming_tasks: Task[];
}
