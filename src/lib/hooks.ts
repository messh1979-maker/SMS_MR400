import { useCallback, useEffect, useRef, useState } from "react";
import type { SwrMeta } from "@/lib/types";

export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Cache-First + Stale-While-Revalidate:
 * (۱) رندر اول: بک‌اند از کش پاسخ می‌دهد و بازآوری را در پس‌زمینه اجرا می‌کند.
 * (۲) رندر دوم (بعد از revalidate): نسخهٔ تازه را می‌گیرد (سرویس‌دهنده کش را ارتقا داده).
 * fetcher باید تابعی باشد که با force=true پارامتر refresh=1 را روی مسیر می‌گذارد.
 */
export function useCachedThenRefresh<T extends SwrMeta>(
  fetcher: (force: boolean) => Promise<T>,
  { revalidate = 900 }: { revalidate?: number } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // ضد race: فقط نتیجهٔ آخرین فراخوانی لحاظ می‌شود
  const run = useCallback(
    async (force: boolean) => {
      const id = ++seq.current;
      setError(null);
      if (force) setStale(true);
      try {
        const res = await fetcher(force);
        if (seq.current !== id) return;
        setData(res);
        if (res?.cached) {
          // رندر دوم — منتظر کامل شدن بازآوری پس‌زمینهٔ سرویس‌دهنده
          await new Promise((r) => setTimeout(r, revalidate));
          if (seq.current !== id) return;
          const res2 = await fetcher(false);
          if (seq.current !== id) return;
          setData(res2);
        }
        setStale(false);
      } catch (err) {
        if (seq.current !== id) return;
        setError(err instanceof Error ? err.message : "خطا در دریافت داده");
        setStale(false);
      } finally {
        if (seq.current === id) setLoading(false);
      }
    },
    [fetcher, revalidate]
  );

  useEffect(() => {
    void run(false);
    return () => {
      seq.current++;
    };
  }, [run]);

  return { data, loading, stale, error, refresh: () => run(true), reload: () => run(false) };
}