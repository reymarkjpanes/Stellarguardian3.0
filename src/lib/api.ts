/**
 * src/lib/api.ts
 * Centralized API client with automatic token refresh.
 *
 * Architecture notes:
 * - Access token (short-lived, 15m) stored in localStorage under "token".
 * - Refresh token (long-lived, 30d) stored in localStorage under "refreshToken".
 * - On 401, the interceptor sends the refresh token in the request body to
 *   POST /api/auth/refresh and retries queued requests with the new access token.
 * - Future auth strategies (SEP-10, OAuth) will follow the same token-pair pattern.
 */

export const API_URL = "/api";

export const getAuthToken = (): string | null => localStorage.getItem("token");
export const getRefreshToken = (): string | null => localStorage.getItem("refreshToken");

// ─── Refresh queue (prevents concurrent refresh calls) ────────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

/**
 * Main API fetch wrapper.
 * Automatically attaches Bearer token and handles refresh on 401.
 * All backend responses use the `{ data: { ... } }` envelope (modular routes).
 */
export const fetchApi = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const reqOptions: RequestInit = {
    ...options,
    headers,
  };

  let res = await fetch(`${API_URL}${endpoint}`, reqOptions);

  // ─── Token refresh on 401 ────────────────────────────────────────────────────
  if (res.status === 401 && endpoint !== "/auth/refresh" && endpoint !== "/auth/login") {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error("Session expired");
        }

        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
          throw new Error("Session expired");
        }

        const refreshData = await refreshRes.json();
        const newToken = refreshData.data.accessToken;
        const newRefreshToken = refreshData.data.refreshToken;
        localStorage.setItem("token", newToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }
        onRefreshed(newToken);
      } catch (err) {
        // Refresh failed — clear everything and propagate
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        onRefreshed("");
        throw err;
      } finally {
        isRefreshing = false;
      }
    }

    // Wait for the refresh to complete (handles concurrent 401s)
    const newToken = await new Promise<string>((resolve) => {
      addRefreshSubscriber((token) => resolve(token));
    });

    if (newToken) {
      // Retry the original request with the fresh token
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, { ...reqOptions, headers });
    }
  }

  // ─── Error handling ──────────────────────────────────────────────────────────
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Support both error shapes: { error: { message } } and { error: "string" }
    const message =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || "An API error occurred";
    throw new Error(message);
  }

  return res.json();
};
