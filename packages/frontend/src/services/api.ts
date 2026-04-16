// =============================================================================
// ThumbForge AI — API Client
// =============================================================================

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store.js';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_ROUTES_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// ─── Request Interceptor ──────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor (token refresh) ─────────────────────────────────

let refreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const requestUrl = String(original?.url ?? '');
    const shouldSkipRefresh =
      !original ||
      AUTH_ROUTES_WITHOUT_REFRESH.some((route) => requestUrl.includes(route));

    if (error.response?.status === 401 && !shouldSkipRefresh && !original._retry) {
      if (refreshing) {
        // Queue request while refreshing
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            original.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      refreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        onTokenRefreshed(newToken);
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Type-safe API methods ────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<ApiResponse<{ userId: string }>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<{ accessToken: string; expiresIn: number }>>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  refresh: () =>
    api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),

  me: () =>
    api.get<
      ApiResponse<{
        id: string;
        tenantId: string;
        name: string;
        email: string;
        role: string;
        avatarUrl?: string | null;
      }>
    >('/auth/me'),
};

export const generationsApi = {
  create: (formData: FormData) =>
    api.post('/generations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/generations', { params }),

  get: (id: string) => api.get(`/generations/${id}`),

  cancel: (id: string) => api.delete(`/generations/${id}`),

  getCreativeSummary: (id: string) => api.get(`/generations/${id}/creative-summary`),
};

export const referenceAnalyzerApi = {
  analyze: (formData: FormData) =>
    api.post('/reference-analyzer/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),

  getAnalysis: (id: string) => api.get(`/reference-analyzer/${id}`),

  listForGeneration: (generationId: string) =>
    api.get(`/reference-analyzer/generation/${generationId}`),
};

export const promptBuilderApi = {
  build: (input: Record<string, unknown>) =>
    api.post('/prompt-builder/build', input),

  buildAll: (input: Record<string, unknown>) =>
    api.post('/prompt-builder/build-all', input),

  buildFromAnalysis: (data: {
    referenceAnalysisId: string;
    variantType?: string;
    overrides?: Record<string, unknown>;
  }) => api.post('/prompt-builder/from-analysis', data),
};

export const semanticEditorApi = {
  draft: (generationId: string, data: {
    baseVariantId?: string;
    prompt: string;
    preserve?: string[];
  }) => api.post(`/semantic-editor/${generationId}/draft`, data),

  commit: (generationId: string, data: {
    baseVariantId?: string;
    prompt: string;
    preserve?: string[];
  }) => api.post(`/semantic-editor/${generationId}/commit`, data),

  apply: (editOperationId: string) =>
    api.post(`/semantic-editor/operations/${editOperationId}/apply`),

  getHistory: (generationId: string) =>
    api.get(`/semantic-editor/${generationId}/history`),

  getOperation: (id: string) =>
    api.get(`/semantic-editor/operations/${id}`),
};

export const exportsApi = {
  create: (variantId: string, options?: Record<string, unknown>) =>
    api.post('/exports', { variantId, options }),

  get: (jobId: string) => api.get(`/exports/${jobId}`),

  listForVariant: (variantId: string) =>
    api.get(`/exports/variant/${variantId}`),
};

export const paymentsApi = {
  create: (data: {
    type: 'SUBSCRIPTION' | 'SINGLE_VARIANT' | 'COMBO_VARIANTS';
    variantIds?: string[];
    subscriptionPlanId?: string;
  }) => api.post('/payments', data),

  get: (id: string) => api.get(`/payments/${id}`),

  list: () => api.get('/payments'),
};

export const downloadsApi = {
  request: (variantId: string) =>
    api.get<ApiResponse<{ downloadUrl: string; expiresAt: string }>>(
      `/downloads/${variantId}`,
    ),

  list: () => api.get('/downloads'),
};

export const templatesApi = {
  list: (params?: { category?: string }) =>
    api.get('/templates', { params }),

  get: (id: string) => api.get(`/templates/${id}`),
};

export const subscriptionsApi = {
  current: () => api.get('/subscriptions/current'),
  plans: () => api.get('/plans'),
};
