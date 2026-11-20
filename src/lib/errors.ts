/**
 * Errors thrown by the Circle SDK (axios-based) carry an HTTP response.
 * `catch` gives us `unknown`; this narrows it to something we can read safely.
 */
export type ApiError = Error & {
  response?: { status?: number; statusText?: string; data?: unknown };
};

export function asApiError(e: unknown): ApiError {
  if (e instanceof Error) return e as ApiError;
  if (e && typeof e === 'object') return Object.assign(new Error(String((e as { message?: unknown }).message ?? e)), e) as ApiError;
  return new Error(String(e)) as ApiError;
}
