import { apiRequest } from './api';
import {
  GatewayChatRequest,
  GatewayChatResponse,
  HealthResponse,
  LiveRequestResult,
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
  apiKey: string
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
      roundTripLatencyMs: durationMs,
      timestamp: new Date().toLocaleTimeString(),
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
