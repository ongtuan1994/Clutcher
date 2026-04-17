const TOKEN_KEY = 'sg_token';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return p;
  return `${API_BASE}${p}`;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiUser = {
  id: string;
  email: string;
  displayName: string | null;
  monthlyIncome: number;
  avatarUrl: string | null;
  isAdmin?: boolean;
};

export type ApiSubscription = {
  id: string;
  name: string;
  category: string;
  amount: number;
  billingCycle: 'Weekly' | 'Monthly' | 'Yearly';
  billingStart: string;
  icon: string;
  archived: boolean;
};

export type ApiReconciliationRecord = {
  id: string;
  month: string;
  year: number;
  monthNum: number;
  projected: number;
  realBalance: number;
  date: string;
  status: 'Balanced' | 'Adjusted' | 'Perfect Match';
};

export type ApiError = { error: string };

async function parseJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    if (/^\s*</.test(text)) {
      throw new Error(
        'Server returned HTML instead of JSON. For production hosting set VITE_API_BASE_URL; in dev ensure the API is running (e.g. npm run dev) and port 4000 is reachable.',
      );
    }
    throw new Error('Invalid server response');
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const r = await fetch(apiUrl(path), { ...options, headers });

  if (r.status === 204) return {} as T;

  const data = await parseJson<T & ApiError>(r);

  if (!r.ok) {
    const msg = (data as ApiError).error || r.statusText || 'Request failed';
    const err = new Error(msg) as Error & { status: number };
    err.status = r.status;
    throw err;
  }

  return data as T;
}

export const authApi = {
  register: (body: { email: string; password: string; displayName?: string }) =>
    api<{ token: string; user: ApiUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  login: (body: { email: string; password: string }) =>
    api<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  me: () => api<{ user: ApiUser }>('/api/auth/me'),
};

export const profileApi = {
  patch: (body: { displayName?: string | null; monthlyIncome?: number }) =>
    api<{ user: ApiUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api<{ user: ApiUser }>('/api/profile/avatar', { method: 'POST', body: fd });
  },
};

export const subscriptionsApi = {
  list: (q?: string) =>
    api<{ subscriptions: ApiSubscription[] }>(
      q ? `/api/subscriptions?q=${encodeURIComponent(q)}` : '/api/subscriptions',
    ),

  create: (body: {
    name: string;
    category: string;
    amount: number;
    billingCycle: string;
    billingStart: string;
    icon?: string;
  }) => api<{ subscription: ApiSubscription }>('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) }),

  patch: (id: string, body: Partial<ApiSubscription> & { billingStart?: string }) =>
    api<{ subscription: ApiSubscription }>(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  remove: (id: string) => api<Record<string, never>>(`/api/subscriptions/${id}`, { method: 'DELETE' }),
};

export const reconciliationApi = {
  list: () => api<{ records: ApiReconciliationRecord[] }>('/api/reconciliation'),

  record: (body: { year: number; month: number; realBalance: number }) =>
    api<{ record: ApiReconciliationRecord }>('/api/reconciliation', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const analyticsApi = {
  summary: () =>
    api<{
      monthlySubscriptionTotal: number;
      yearlyProjected: number;
      monthlyIncome: number;
      incomeCoversTimes: number | null;
      flow: { month: string; income: number; subs: number }[];
    }>('/api/analytics/summary'),

  trajectory: () =>
    api<{
      points: { label: string; real: number; projected: number }[];
      defaultProjected: number;
    }>('/api/analytics/trajectory'),
};

export const skyAssetsApi = {
  list: () => api<{ assets: Record<string, string | null> }>('/api/sky-assets', { skipAuth: true }),
};

export const adminApi = {
  uploadSkyAsset: (score: number, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api<{ score: number; url: string }>(`/api/admin/sky-assets/${score}`, { method: 'POST', body: fd });
  },
};
