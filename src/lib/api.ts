export const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const TIMEOUT_MS = 25000;

export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const hasBody = options.body !== undefined;
    const res = await fetch(`${BASE}${path}`, {
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