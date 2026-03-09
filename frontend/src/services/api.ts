import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  Task,
  TaskStats,
  TaskRecommendation,
  Note,
  TaskCompletionData,
  PriorityDistribution,
  ProductivityMetrics,
  ApiResponse,
  AuthResponse,
  GoogleIntegrationStatus,
  GmailSender,
  GmailDiscoveredSender,
  GmailSyncStatus,
  CalendarSyncResult,
  BulkTaskResult,
  DigestSettings,
  AssistantDigest,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_BASE_URL && import.meta.env.PROD) {
  console.error('VITE_API_URL is not configured. API calls will fail in production.');
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL || 'http://127.0.0.1:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token (check both storages for rememberMe support)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/login', credentials);
    return response.data.data;
  },

  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const { confirmPassword, ...registerData } = credentials;
    const response = await api.post<ApiResponse<AuthResponse>>('/register', registerData);
    return response.data.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>('/profile');
    return response.data.data;
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await api.put<ApiResponse<User>>('/profile', userData);
    return response.data.data;
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<void> => {
    await api.post<ApiResponse<null>>('/auth/change-password', data);
  },
};

// Tasks API
export const tasksApi = {
  getAll: async (): Promise<Task[]> => {
    const response = await api.get<ApiResponse<Task[]>>('/tasks');
    return response.data.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await api.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  create: async (task: Omit<Task, 'id' | 'created_at'>): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>('/tasks', task);
    return response.data.data;
  },

  update: async (id: string, task: Partial<Task>): Promise<Task> => {
    const response = await api.put<ApiResponse<Task>>(`/tasks/${id}`, task);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/tasks/${id}`);
  },

  bulkAction: async (action: 'complete' | 'reopen' | 'delete', ids: string[]): Promise<BulkTaskResult> => {
    const response = await api.post<ApiResponse<BulkTaskResult>>('/tasks/bulk', { action, ids });
    return response.data.data;
  },

  getStats: async (): Promise<TaskStats> => {
    const response = await api.get<ApiResponse<TaskStats>>('/tasks/stats');
    return response.data.data;
  },

  getRecommendation: async (): Promise<TaskRecommendation | null> => {
    const response = await api.get<ApiResponse<TaskRecommendation | null>>('/tasks/recommend');
    return response.data.data;
  },
};

// Notes API
export const notesApi = {
  getAll: async (): Promise<Note[]> => {
    const response = await api.get<ApiResponse<Note[]>>('/notes');
    return response.data.data;
  },

  getById: async (id: string): Promise<Note> => {
    const response = await api.get<ApiResponse<Note>>(`/notes/${id}`);
    return response.data.data;
  },

  create: async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> => {
    const response = await api.post<ApiResponse<Note>>('/notes', note);
    return response.data.data;
  },

  update: async (id: string, note: Partial<Note>): Promise<Note> => {
    const response = await api.put<ApiResponse<Note>>(`/notes/${id}`, note);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete<ApiResponse<void>>(`/notes/${id}`);
  },
};

// Analytics API
export const analyticsApi = {
  getTaskCompletion: async (days: number = 30): Promise<TaskCompletionData[]> => {
    const response = await api.get<ApiResponse<TaskCompletionData[]>>(`/analytics/tasks/completion?days=${days}`);
    return response.data.data;
  },

  getPriorityDistribution: async (): Promise<PriorityDistribution[]> => {
    const response = await api.get<ApiResponse<PriorityDistribution[]>>('/analytics/tasks/priority');
    return response.data.data;
  },

  getProductivityMetrics: async (): Promise<ProductivityMetrics> => {
    const response = await api.get<ApiResponse<ProductivityMetrics>>('/analytics/productivity');
    return response.data.data;
  },
};

// Integrations API
export const integrationsApi = {
  // Google OAuth
  getGoogleAuthUrl: async (): Promise<string> => {
    const response = await api.get<ApiResponse<{ auth_url: string }>>('/integrations/google/auth-url');
    return response.data.data.auth_url;
  },

  getGoogleStatus: async (): Promise<GoogleIntegrationStatus> => {
    const response = await api.get<ApiResponse<GoogleIntegrationStatus>>('/integrations/google/status');
    return response.data.data;
  },

  disconnectGoogle: async (): Promise<void> => {
    await api.delete<ApiResponse<null>>('/integrations/google/disconnect');
  },

  // Sender whitelist
  getSenders: async (): Promise<GmailSender[]> => {
    const response = await api.get<ApiResponse<GmailSender[]>>('/integrations/gmail/senders');
    return response.data.data;
  },

  addSender: async (email: string): Promise<GmailSender> => {
    const response = await api.post<ApiResponse<GmailSender>>('/integrations/gmail/senders', { email });
    return response.data.data;
  },

  removeSender: async (email: string): Promise<void> => {
    await api.delete<ApiResponse<null>>(`/integrations/gmail/senders/${encodeURIComponent(email)}`);
  },

  discoverSenders: async (): Promise<GmailDiscoveredSender[]> => {
    const response = await api.get<ApiResponse<GmailDiscoveredSender[]>>('/integrations/gmail/senders/discover');
    return response.data.data;
  },

  // Sync
  syncGmail: async (): Promise<{ status: string }> => {
    const response = await api.post<ApiResponse<{ status: string }>>('/integrations/gmail/sync');
    return response.data.data;
  },

  getGmailSyncStatus: async (): Promise<GmailSyncStatus> => {
    const response = await api.get<ApiResponse<GmailSyncStatus>>('/integrations/gmail/sync/status');
    return response.data.data;
  },

  syncCalendar: async (): Promise<CalendarSyncResult> => {
    const response = await api.post<ApiResponse<CalendarSyncResult>>('/integrations/calendar/sync');
    return response.data.data;
  },

  pushTaskToCalendar: async (taskId: string): Promise<{ event_id: string }> => {
    const response = await api.post<ApiResponse<{ event_id: string }>>(`/tasks/${taskId}/calendar`);
    return response.data.data;
  },

  // Weekly digest
  getDigestSettings: async (): Promise<DigestSettings> => {
    const response = await api.get<ApiResponse<DigestSettings>>('/digest/settings');
    return response.data.data;
  },

  updateDigestSettings: async (data: Partial<DigestSettings>): Promise<DigestSettings> => {
    const response = await api.put<ApiResponse<DigestSettings>>('/digest/settings', data);
    return response.data.data;
  },

  sendDigestNow: async (): Promise<{ sent_to: string }> => {
    const response = await api.post<ApiResponse<{ sent_to: string }>>('/digest/send');
    return response.data.data;
  },
};

// Assistant API
export const assistantApi = {
  getDigest: async (): Promise<AssistantDigest> => {
    const response = await api.get<ApiResponse<AssistantDigest>>('/assistant/digest');
    return response.data.data;
  },
};

export default api;
