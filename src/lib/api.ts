export const API_URL = "/api";

export const getAuthToken = () => localStorage.getItem("token");

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

export const fetchApi = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as any) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Use include credentials if the endpoint is an auth endpoint that requires cookies (like refresh/logout)
  const isAuthRoute = endpoint.startsWith("/auth/");
  const reqOptions: RequestInit = {
    ...options,
    headers,
    credentials: isAuthRoute ? "include" : undefined,
  };

  let res = await fetch(`${API_URL}${endpoint}`, reqOptions);

  if (res.status === 401 && endpoint !== "/auth/refresh" && endpoint !== "/auth/login") {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshRes.ok) {
          throw new Error('Session expired');
        }

        const refreshData = await refreshRes.json();
        const newToken = refreshData.data.accessToken;
        localStorage.setItem('token', newToken);
        onRefreshed(newToken);
      } catch (err) {
        localStorage.removeItem('token');
        onRefreshed('');
        throw err;
      } finally {
        isRefreshing = false;
      }
    }

    // Wait for the refresh to complete
    const newToken = await new Promise<string>((resolve) => {
      addRefreshSubscriber((token) => resolve(token));
    });

    if (newToken) {
      // Retry the original request
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${endpoint}`, { ...reqOptions, headers });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "An API error occurred");
  }

  return res.json();
};
