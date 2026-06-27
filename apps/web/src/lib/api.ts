/**
 * Thin fetch wrapper for the BloodLine API. All calls go to the same origin under
 * `/api/...` (Next rewrites to the backend) and include cookies for auth.
 */
export interface ApiErrorShape {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorShape | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? res.statusText);
  }
  return body as T;
}
