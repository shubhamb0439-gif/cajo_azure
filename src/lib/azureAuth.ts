const API_BASE_URL = import.meta.env.VITE_AZURE_API_BASE_URL as string;
const API_KEY = import.meta.env.VITE_AZURE_API_KEY as string;

export interface AzureUser {
  id: string;
  email: string;
  name: string;
  role: string;
  user_rights: string;
  enabled: boolean;
  customer_id: string | null;
  profile_picture_url: string | null;
  auth_user_id: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AzureUser;
}

const TOKEN_KEY = 'azure_access_token';
const REFRESH_KEY = 'azure_refresh_token';
const USER_KEY = 'azure_user';
const EXPIRES_KEY = 'azure_token_expires_at';

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['x-functions-key'] = API_KEY;
  return headers;
}

async function authPost<T>(path: string, body: unknown): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      return { data: null, error: json.message || 'Request failed' };
    }
    return { data: json as T, error: null };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export const azureAuth = {
  getSession(): AuthSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    if (!token || !user || !expiresAt) return null;

    const expires = parseInt(expiresAt, 10);
    if (Date.now() > expires) {
      return null;
    }

    try {
      return {
        access_token: token,
        refresh_token: refreshToken || '',
        expires_at: expires,
        user: JSON.parse(user) as AzureUser,
      };
    } catch {
      return null;
    }
  },

  saveSession(session: AuthSession): void {
    localStorage.setItem(TOKEN_KEY, session.access_token);
    localStorage.setItem(REFRESH_KEY, session.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    localStorage.setItem(EXPIRES_KEY, String(session.expires_at));
  },

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  },

  async signIn(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
    const { data, error } = await authPost<AuthSession>('/auth/sign-in', { email, password });
    if (error || !data) return { session: null, error: error || 'Sign-in failed' };
    azureAuth.saveSession(data);
    return { session: data, error: null };
  },

  async signUp(
    email: string,
    password: string,
    name: string
  ): Promise<{ error: string | null }> {
    const { error } = await authPost('/auth/sign-up', { email, password, name });
    return { error };
  },

  async signOut(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/sign-out`, {
          method: 'POST',
          headers: {
            ...authHeaders(),
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
      }
    }
    azureAuth.clearSession();
  },

  async refreshSession(): Promise<{ session: AuthSession | null; error: string | null }> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return { session: null, error: 'No refresh token' };

    const { data, error } = await authPost<AuthSession>('/auth/refresh', { refresh_token: refreshToken });
    if (error || !data) {
      azureAuth.clearSession();
      return { session: null, error: error || 'Refresh failed' };
    }
    azureAuth.saveSession(data);
    return { session: data, error: null };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          Authorization: `Bearer ${token}`,
        } as HeadersInit,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await response.json();
      if (!response.ok) return { error: json.message || 'Failed to change password' };
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Network error' };
    }
  },

  async updateProfile(updates: Partial<AzureUser>): Promise<{ user: AzureUser | null; error: string | null }> {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
          Authorization: `Bearer ${token}`,
        } as HeadersInit,
        body: JSON.stringify(updates),
      });
      const json = await response.json();
      if (!response.ok) return { user: null, error: json.message || 'Failed to update profile' };

      const current = localStorage.getItem(USER_KEY);
      if (current) {
        const merged = { ...JSON.parse(current), ...json };
        localStorage.setItem(USER_KEY, JSON.stringify(merged));
      }
      return { user: json as AzureUser, error: null };
    } catch (err: unknown) {
      return { user: null, error: err instanceof Error ? err.message : 'Network error' };
    }
  },

  isTokenExpiringSoon(): boolean {
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    if (!expiresAt) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() > parseInt(expiresAt, 10) - fiveMinutes;
  },
};
