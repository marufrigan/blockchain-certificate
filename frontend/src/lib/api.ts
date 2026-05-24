/**
 * In the browser, call same-origin `/api/...` — Next.js rewrites to Express (see next.config.js).
 * That avoids CORS and localhost/IPv6 mismatches with port 4000.
 */
function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  }
  return "";
}

/** For logs / debugging */
export const API_URL = apiBase() || "http://127.0.0.1:4000 (proxied via Next as /api/...)";

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const base = apiBase();
  const timeoutMs = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? `Request timed out after ${timeoutMs / 1000}s. Is the API running? Check http://127.0.0.1:4000/health`
        : e instanceof TypeError
          ? `Cannot reach API. Run npm run dev and check http://127.0.0.1:4000/health`
          : "Network error";
    throw new Error(msg);
  }
  clearTimeout(timer);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data as T;
}
