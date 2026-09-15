import { RefreshCw, Signal, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ModemStatus = {
  connected: boolean | null;
  network_type?: string;
  signal_level?: number | null;
  sim_status?: string;
  unread_sms?: number | null;
};

export default function ModemStatusBar({
  status,
  refreshing,
  onRefresh,
}: {
  status: ModemStatus;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const signal = Math.max(0, Math.min(100, status.signal_level ?? 0));
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-label="وضعیت اتصال به مودم، سیگنال و سیم‌کارت"
      className="border-b border-slate-200/70 bg-background/85 px-4 py-2 backdrop-blur-xl dark:border-white/5"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              status.connected === true
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                : status.connected === false
                  ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            )}
            title={status.connected === null ? "در حال اتصال" : status.connected ? "متصل" : "قطع"}
            aria-label="وضعیت اتصال به مودم"
          >
            <Wifi className="h-3.5 w-3.5" />
          </span>

          <span
            className={cn(
              "hidden text-xs font-bold lg:block",
              status.connected === null
                ? "text-slate-500"
                : status.connected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500"
            )}
          >
            {status.connected === null ? "در حال اتصال به مودم..." : status.connected ? "مودم متصل است" : "خطا در اتصال"}
          </span>

          <span className="flex items-center gap-1.5" aria-label={`سطح سیگنال ${faDigits(signal)} درصد`} title={`سیگنال: ${faDigits(signal)}٪`}>
            <Signal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span
                className={cn("block h-full rounded-full", signal > 50 ? "bg-emerald-500" : signal > 20 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${signal}%` }}
              />
            </span>
            <span className="fa-nums hidden text-[11px] font-medium text-muted-foreground sm:inline">{faDigits(signal)}٪</span>
          </span>

          {status.network_type ? (
            <span className="hidden items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 md:flex dark:bg-slate-800 dark:text-slate-300" title="نوع شبکه">
              {faDigits(status.network_type)}
            </span>
          ) : null}

          <span className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] sm:flex dark:bg-slate-800" aria-label="وضعیت سیم‌کارت" title="وضعیت سیم‌کارت">
            <Smartphone className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            {faDigits(status.sim_status ?? "—")}
          </span>
        </div>

        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing} className="shrink-0 gap-1.5 text-xs" aria-label="تازه‌سازی وضعیت مودم">
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          <span className="hidden sm:inline">تازه‌سازی وضعیت</span>
        </Button>
      </div>
    </div>
  );
}