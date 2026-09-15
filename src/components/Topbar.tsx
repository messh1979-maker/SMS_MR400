import { Command, Moon, RefreshCw, Sun, Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/format";
import type { PageId } from "@/lib/types";

const TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: "داشبورد", subtitle: "نمای کلی فعالیت پیامک‌ها" },
  send: { title: "ارسال پیامک", subtitle: "ارسال تک‌تکه یا انبوه" },
  inbox: { title: "صندوق دریافت", subtitle: "پیامک‌های دریافتی از مودم" },
  history: { title: "تاریخچه و لاگ", subtitle: "پیامک‌های ارسال‌شده و خروجی فایل" },
  contacts: { title: "مخاطبین", subtitle: "شماره‌های پرتکرار و دسته‌بندی‌شده" },
  scheduled: { title: "صف ارسال", subtitle: "پیامک‌های زمان‌بندی‌شده و وضعیت تلاش‌ها" },
  settings: { title: "تنظیمات و API", subtitle: "اتصال، پیکربندی و مستندات" },
};

const BRAND_HEADER = (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
    <div className="flex flex-col items-center gap-0.5 text-center" dir="rtl">
      <span className="text-sm font-bold text-slate-900 dark:text-white">سامانه مدیریت پیامکی</span>
      <span className="text-[11px] font-medium text-muted-foreground">اداره برق و مخابرات - شرکت آب و فاضلاب خراسان رضوی</span>
    </div>
  </div>
);

export default function Topbar({
  page,
  dark,
  onToggleTheme,
  onOpenCommand,
  onRefresh,
  refreshing,
  connected,
  signalLevel,
}: {
  page: PageId;
  dark: boolean;
  onToggleTheme: () => void;
  onOpenCommand: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  connected: boolean | null;
  signalLevel?: number | null;
}) {
  const t = TITLES[page];
  const signal = Math.max(0, Math.min(100, signalLevel ?? 0));
  return (
    <header
      dir="rtl"
      className="relative flex items-center justify-between gap-4 border-b border-slate-200/70 bg-background/80 px-5 py-3 backdrop-blur-xl dark:border-white/5"
    >
      {/* برند هدر - وسط‌چین مطلق */}
      {BRAND_HEADER}

      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-right">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{t.title}</h2>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{t.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* قرص اتصال */}
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex",
              connected === null
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : connected
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected === null
                  ? "bg-slate-400"
                  : connected
                    ? "bg-emerald-500"
                    : "bg-red-500"
              )}
            />
            {connected === null ? "در حال بررسی..." : connected ? "متصل به خط" : "قطع"}
          </span>

          {/* سیگنال مودم */}
          {connected !== null && (
            <span className="flex items-center gap-1.5" aria-label={`سطح سیگنال ${faDigits(signal)} درصد`} title={`سیگنال: ${faDigits(signal)}٪`}>
              <Signal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <span
                  className={cn("block h-full rounded-full", signal > 50 ? "bg-emerald-500" : signal > 20 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${signal}%` }}
                />
              </span>
              <span className="fa-nums text-[10px] font-medium text-muted-foreground">{faDigits(signal)}٪</span>
            </span>
          )}

          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            به‌روزرسانی
          </Button>

          <button
            onClick={onOpenCommand}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
            title="جست‌وجوی سریع"
          >
            <Command className="h-3.5 w-3.5" />
            <kbd className="hidden items-center gap-0.5 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-500 sm:flex dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
              Ctrl K
            </kbd>
          </button>

          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
            title={dark ? "حالت روشن" : "حالت تاریک"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}