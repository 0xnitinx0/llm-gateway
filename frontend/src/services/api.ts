import { ApiError } from '../types/gateway';

/**
 * Base URL determination:
 * In development, we use relative URL '/api' which Vite proxies to http://127.0.0.1:8000
 * In production or custom setup, VITE_API_BASE_URL can override it.
 */
const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof window !== 'undefined' && window.location.origin.includes('localhost:5173')) {
    // In local Vite dev server, use the proxy route to prevent CORS errors with backend
    return '/api';
  }
  return envUrl || '/api';
};

export const API_BASE_URL = getBaseUrl();

export const getGatewayApiKey = (): string | null => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('gateway_api_key');
    if (stored) return stored;
  }
  return import.meta.env.VITE_GATEWAY_API_KEY || null;
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = getGatewayApiKey();
  if (apiKey) {
    defaultHeaders['X-Gateway-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback to response status text
        if (response.statusText) {
          errorMessage = response.statusText;
        }
      }

      const error: ApiError = {
        detail: errorMessage,
        status: response.status,
      };
      throw error;
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if ((err as ApiError).status !== undefined) {
      throw err;
    }

    // Network error or unreachable backend
    const networkError: ApiError = {
      detail: 'Unable to reach the Gateway. Check that FastAPI is running on the configured endpoint.',
      status: 0,
    };
    throw networkError;
  }
}
