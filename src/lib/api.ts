export const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const TIMEOUT_MS = 25000;

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  const query = options.query
    ? Object.entries(options.query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = query ? `${BASE}${path}?${query}` : `${BASE}${path}`;
  try {
    const hasBody = options.body !== undefined;
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        "X-API-Key": API_KEY,
      },
      body: hasBody ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error ?? `خطای سرور (${res.status})`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("سرور پشتیبان در دسترس نیست (مهلت درخواست تمام شد).");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}