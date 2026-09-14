import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, History, Search } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { downloadCsv, faDigits, formatTime } from "@/lib/format";
import { getCategory } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import type { SentEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

export default function HistoryPage() {
  const [entries, setEntries] = useState<SentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/history`);
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      showToast("خطا در دریافت تاریخچه", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (search ? entries.filter((e) => e.phone.includes(search) || e.message.includes(search)) : entries),
    [entries, search]
  );

  function exportCsv() {
    if (entries.length === 0) return;
    downloadCsv(
      `sms-history-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["زمان", "شماره", "متن"],
        ...entries.map((e) => [e.sent_at, e.phone, e.message]),
      ]
    );
    showToast("فایل CSV دانلود شد.");
  }

  return (
    <div dir="rtl" className="fade-in-up space-y-4">
      <BentoBox className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در تاریخچه..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0} className="gap-1.5 text-xs">
          <Download className="h-4 w-4" />
          خروجی CSV
        </Button>
      </BentoBox>

      <BentoBox>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">هنوز پیامکی ارسال نشده است.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map((e, i) => {
              const cat = getCategory(e.phone);
              return (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white",
                      cat.avatar
                    )}
                  >
                    {e.phone.slice(-2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="fa-nums text-sm font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                          {faDigits(e.phone)}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat.pill)}>{cat.label}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {formatTime(e.sent_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[13px] leading-[1.6] text-slate-700 dark:text-slate-300">
                      {e.message}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ارسال شده
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </BentoBox>
    </div>
  );
}