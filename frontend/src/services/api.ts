import { ApiError, RateObservation } from '../types/gateway';

export const API_BASE_URL = '/api';
export type AuthScope = 'none' | 'gateway' | 'admin';
export const CREDENTIAL_EVENT = 'gateway-credentials';
export const TELEMETRY_EVENT = 'gateway-telemetry';
const announce = (event: string) => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(event)); };
export const refreshTelemetry = () => announce(TELEMETRY_EVENT);
export const getGatewayApiKey = (): string | null => localStorage.getItem('gateway_api_key');
export const getAdminApiKey = (): string | null => sessionStorage.getItem('admin_api_key');
export const setGatewayApiKey = (value: string): void => {
  if (value.trim()) localStorage.setItem('gateway_api_key', value.trim());
  else localStorage.removeItem('gateway_api_key');
  announce(CREDENTIAL_EVENT);
};
export const setAdminApiKey = (value: string): void => {
  if (value.trim()) sessionStorage.setItem('admin_api_key', value.trim());
  else sessionStorage.removeItem('admin_api_key');
  announce(CREDENTIAL_EVENT);
};
export const rateObservation = (response: Response): RateObservation => {
  const number = (name: string) => { const value = response.headers.get(name); return value === null ? null : Number(value); };
  return { status: response.status, remaining: number('X-RateLimit-Remaining'), limit: number('X-RateLimit-Limit'), retryAfter: number('Retry-After'), observedAt: Date.now() };
};
export const retrySeconds = (observation: RateObservation, now = Date.now()) => Math.max(0, Math.ceil(((observation.retryAfter ?? 0) * 1000 + observation.observedAt - now) / 1000));

export async function apiFetch(endpoint: string, options: RequestInit = {}, auth: AuthScope = 'gateway'): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const key = auth === 'gateway' ? getGatewayApiKey() : auth === 'admin' ? getAdminApiKey() : null;
  if (auth === 'admin' && !key) throw { detail: 'Enter the admin key in Settings to unlock live telemetry.', status: 401 } as ApiError;
  if (key && !headers.has(auth === 'admin' ? 'X-Admin-Key' : 'X-Gateway-API-Key')) headers.set(auth === 'admin' ? 'X-Admin-Key' : 'X-Gateway-API-Key', key);
  try {
    return await fetch(API_BASE_URL + (endpoint.startsWith('/') ? endpoint : '/' + endpoint), { ...options, headers });
  } catch (error) {
    if (options.signal?.aborted || (error as Error).name === 'AbortError') throw error;
    throw { detail: 'Unable to reach the Gateway. Check that FastAPI is running on port 8000.', status: 0 } as ApiError;
  }
}
export async function responseError(response: Response): Promise<ApiError> {
  let detail = 'Request failed with status ' + response.status;
  try { const body = await response.json(); detail = body?.error?.message ?? (typeof body?.detail === 'string' ? body.detail : detail); }
  catch { if (response.statusText) detail = response.statusText; }
  const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
  if (response.status === 429 && retryAfter) detail += ' Retry after ' + retryAfter + ' seconds.';
  return { detail, status: response.status, retryAfter, requestId: response.headers.get('X-Request-ID') || undefined };
}
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}, auth: AuthScope = 'gateway'): Promise<T> {
  const response = await apiFetch(endpoint, options, auth);
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
