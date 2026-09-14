import { useEffect, useState } from "react";
import { BookOpen, Cable, Globe, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

const ENDPOINTS = [
  { method: "GET", path: "/api/status", desc: "وضعیت اتصال، شبکه و سیم‌کارت" },
  { method: "GET", path: "/api/inbox", desc: "لیست پیامک‌های دریافتی" },
  { method: "POST", path: "/api/send_sms", desc: "ارسال پیامک (شماره + متن)" },
  { method: "DELETE", path: "/api/sms", desc: "حذف گروهی پیامک‌ها (ids)" },
  { method: "GET", path: "/api/stats", desc: "آمار وارده/ارسال‌شده" },
  { method: "GET", path: "/api/activity", desc: "سری زمانی روزانه برای نمودار" },
  { method: "GET", path: "/api/contacts", desc: "مخاطبین استخراج‌شده" },
  { method: "GET", path: "/api/history", desc: "تاریخچه پیامک‌های ارسال‌شده" },
];

type Status = { connected: boolean; network_type?: string; signal_level?: number | null; sim_status?: string };

export default function SettingsPage() {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  async function testConnection() {
    setChecking(true);
    try {
      const res = await fetch(`${API}/api/status`);
      const data = await res.json();
      setStatus({ connected: res.ok, ...data });
      setLastCheck(new Date().toLocaleTimeString("fa-IR"));
      showToast(res.ok ? "اتصال به مودم برقرار است." : "خطا در دریافت وضعیت", res.ok ? false : true);
    } catch {
      setStatus({ connected: false });
      setLastCheck(new Date().toLocaleTimeString("fa-IR"));
      showToast("سرور پشتیبان در دسترس نیست.", true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div dir="rtl" className="fade-in-up grid gap-4 lg:grid-cols-2">
      <BentoBox title="اتصال و مودم" icon={Cable}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-4 w-4" /> آدرس IP مودم
            </span>
            <code dir="ltr" className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-700">172.16.33.254</code>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> وضعیت اتصال
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                !status
                  ? "bg-slate-100 text-slate-500"
                  : status.connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
              )}
            >
              {!status ? "در حال بررسی..." : status.connected ? "متصل" : "قطع"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">شبکه</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.network_type ?? "—")}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">سیگنال</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.signal_level ?? 0)}٪</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">سیم‌کارت</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.sim_status ?? "—")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              آخرین بررسی: {lastCheck ? faDigits(lastCheck) : "—"}
            </p>
            <Button size="sm" variant="outline" onClick={testConnection} disabled={checking} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
              تست اتصال
            </Button>
          </div>
        </div>
      </BentoBox>

      <BentoBox title="پیکربندی" icon={Settings2}>
        <div className="space-y-2">
          {[
            { label: "رابط کاربری", value: "Vazirmatn · راست‌به‌چپ", dir: "rtl" as const },
            { label: "سرور پشتیبان", value: API, dir: "ltr" as const },
            { label: "دوره نمودار", value: "۷ روز اخیر", dir: "rtl" as const },
            { label: "ذخیره مخاطبین", value: "دستگاه شما (localStorage)", dir: "rtl" as const },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <code dir={row.dir} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {row.value}
              </code>
            </div>
          ))}
        </div>
      </BentoBox>

      <BentoBox title="مستندات API" icon={BookOpen} className="lg:col-span-2">
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/5">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-muted-foreground dark:bg-slate-800/50">
                <th className="px-3 py-2.5 font-medium">متد</th>
                <th className="px-3 py-2.5 font-medium">مسیر</th>
                <th className="px-3 py-2.5 font-medium">توضیح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold",
                        e.method === "GET"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : e.method === "POST"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                      )}
                    >
                      {e.method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <code dir="ltr" className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{e.path}</code>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BentoBox>
    </div>
  );
}