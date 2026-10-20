const ACCESS_KEY = 'sfm_access_token';
const REFRESH_KEY = 'sfm_refresh_token';

const baseUrl = import.meta.env.VITE_API_URL ?? '';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

const sessionListeners = new Set<() => void>();
let sessionExpiredNotified = false;
let refreshInFlight: Promise<boolean> | null = null;

export function onSessionExpired(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function expireSession() {
  clearTokens();
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  sessionListeners.forEach((fn) => fn());
}

async function rawFetch(path: string, options: RequestOptions = {}, token?: string | null) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  sessionExpiredNotified = false;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  let response = await rawFetch(path, options, getAccessToken());

  if (response.status === 401 && options.auth !== false) {
    const refreshed = getRefreshToken() ? await refreshSession() : false;
    if (refreshed) {
      response = await rawFetch(path, options, getAccessToken());
    }
  }

  if (response.status === 401 && options.auth !== false) {
    expireSession();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const response = await rawFetch(
      '/api/auth/refresh',
      { method: 'POST', body: { refreshToken }, auth: false },
    );
    if (!response.ok) {
      expireSession();
      return false;
    }

    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
