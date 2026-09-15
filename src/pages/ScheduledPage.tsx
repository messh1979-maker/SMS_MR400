import { useEffect, useState } from "react";
import { Clock, Trash2, AlertTriangle, CheckCheck } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { faDigits } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { ScheduledSms } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ScheduledSms["status"] }) {
  const cfg = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
  const labels = { pending: "در انتظار", sent: "ارسال شده", failed: "ناموفق", cancelled: "لغو شده" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", cfg[status])}>
      {labels[status]}
    </span>
  );
}

export default function ScheduledPage() {
  const [items, setItems] = useState<ScheduledSms[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await apiRequest<{ scheduled: ScheduledSms[] }>("/api/scheduled");
      setItems(Array.isArray(data.scheduled) ? data.scheduled : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id: number) {
    try {
      await apiRequest(`/api/scheduled/${id}`, { method: "DELETE" });
      showToast("زمان‌بندی لغو شد.");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا", true);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <h2 className="text-2xl font-bold">صف ارسال پیامک‌های زمان‌بندی‌شده</h2>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : items.length === 0 ? (
        <BentoBox className="py-12 text-center">
          <Clock className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg text-muted-foreground">هیچ پیامک زمان‌بندی‌شده‌ای وجود ندارد.</p>
        </BentoBox>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border bg-card p-4 dark:border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 fa-nums">{faDigits(item.mobile)}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{item.message}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>زمان: {new Date(item.scheduled_at_utc).toLocaleString("fa-IR")}</span>
                  <span>تلاش: {item.retries}/{item.max_retries}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === "sent" && <CheckCheck className="h-5 w-5 text-emerald-500" />}
                {item.status === "failed" && <AlertTriangle className="h-5 w-5 text-red-500" />}
                {item.status !== "sent" && item.status !== "cancelled" && (
                  <Button variant="ghost" size="sm" onClick={() => handleCancel(item.id)} className="text-red-600 hover:text-red-700 gap-1">
                    <Trash2 className="h-4 w-4" /> لغو
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}