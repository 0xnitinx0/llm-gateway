import { apiRequest } from './api';
import {
  GatewayChatRequest,
  GatewayChatResponse,
  HealthResponse,
  LiveRequestResult,
  ApiKeyItem,
  ApiError,
} from '../types/gateway';


/**
 * Check if the backend Gateway is online via GET /health
 */
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const data = await apiRequest<HealthResponse>('/health', {
      method: 'GET',
    });
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Send real chat completion to the FastAPI Gateway
 * Route: POST /v1/chat/completions
 * Auth Header: X-Gateway-API-Key
 * Body: { messages: [{ role: 'user', content: prompt }] }
 * Response: { response: "..." }
 */
export async function sendChatCompletion(
  prompt: string,
  apiKey: string,
  tournament: boolean = false
): Promise<LiveRequestResult> {
  if (!prompt.trim()) {
    const error: ApiError = {
      detail: 'Please enter a prompt.',
      status: 400,
    };
    throw error;
  }

  if (!apiKey.trim()) {
    const error: ApiError = {
      detail: 'Please provide your Gateway API Key.',
      status: 401,
    };
    throw error;
  }

  const payload: GatewayChatRequest = {
    messages: [
      {
        role: 'user',
        content: prompt.trim(),
      },
    ],
    tournament,
  };

  const startTime = performance.now();

  try {
    const data = await apiRequest<GatewayChatResponse>('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'X-Gateway-API-Key': apiKey.trim(),
      },
      body: JSON.stringify(payload),
    });

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    return {
      response: data.response,
      cache_hit: data.cache_hit,
      similarity: data.similarity,
      winning_model: data.winning_model,
      judge_score: data.judge_score,
      provider: data.provider,
      model: data.model,
      candidates: data.candidates,
      candidate_count: data.candidate_count,
      roundTripLatencyMs: durationMs,
      timestamp: new Date().toLocaleTimeString(),
      tournament,
    };
  } catch (err: unknown) {
    const apiErr = err as ApiError;
    if (apiErr.status === 401) {
      throw {
        ...apiErr,
        detail: 'Invalid Gateway API key. Please check your credentials.',
      };
    } else if (apiErr.status === 500) {
      throw {
        ...apiErr,
        detail: apiErr.detail || 'The Gateway encountered an error processing the request.',
      };
    }
    throw err;
  }
}

/**
  Fetch all Gateway API keys from backend POST /v1/api-keys
 */
export async function getApiKeys(): Promise<ApiKeyItem[]> {
  return apiRequest<ApiKeyItem[]>('/v1/api-keys');
}

/**
  Create a new Gateway API key via backend POST /v1/api-keys
 */
export async function createApiKey(
  name: string
): Promise<{ key: ApiKeyItem; secretKey: string }> {
  return apiRequest<{ key: ApiKeyItem; secretKey: string }>('/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/**
  Revoke a Gateway API key via backend DELETE /v1/api-keys/{key_id}
 */
export async function revokeApiKey(keyId: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/v1/api-keys/${keyId}`, {
    method: 'DELETE',
  });
}

