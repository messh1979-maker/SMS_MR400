import { useEffect, useState } from "react";
import { Clock, Trash2, AlertTriangle, CheckCheck, Edit2, Save, X } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ mobile: "", message: "", date: "", time: "", max_retries: 3 });

  async function load() {
    try {
      const data = await apiRequest<{ scheduled: ScheduledSms[] }>("/api/scheduled");
      setItems(Array.isArray(data.scheduled) ? data.scheduled : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(item: ScheduledSms) {
    setEditingId(item.id);
    const j = new Date(item.scheduled_at_utc);
    const date = j.toLocaleDateString("fa-IR");
    const time = `${String(j.getHours()).padStart(2, "0")}:${String(j.getMinutes()).padStart(2, "0")}`;
    setEditForm({ mobile: item.mobile, message: item.message, date, time, max_retries: item.max_retries });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ mobile: "", message: "", date: "", time: "", max_retries: 3 });
  }

  async function handleSave(id: number) {
    try {
      await apiRequest(`/api/scheduled/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          mobile: editForm.mobile,
          message: editForm.message,
          scheduled_at: `${editForm.date} ${editForm.time}`,
          max_retries: Number(editForm.max_retries),
        }),
      });
      showToast("زمان‌بندی بروز شد.");
      setEditingId(null);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در بروزرسانی", true);
    }
  }

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
              {editingId === item.id ? (
                <div className="flex flex-wrap gap-3 w-full">
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">شماره</Label>
                    <Input value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} className="text-sm mt-1" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">پیام</Label>
                    <Input value={editForm.message} onChange={(e) => setEditForm((f) => ({ ...f, message: e.target.value }))} className="text-sm mt-1" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs text-muted-foreground">تاریخ شمسی</Label>
                    <Input value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} placeholder="۱۴۰۵/۰۷/۰۱" className="text-sm mt-1 font-mono" />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground">ساعت ارسال</Label>
                    <Input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} className="text-sm mt-1 font-mono" />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground">تلاش</Label>
                    <Input type="number" value={editForm.max_retries} onChange={(e) => setEditForm((f) => ({ ...f, max_retries: Number(e.target.value) }))} className="text-sm mt-1" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={() => handleSave(item.id)} className="gap-1">
                      <Save className="h-3.5 w-3.5" /> ذخیره
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit} className="gap-1">
                      <X className="h-3.5 w-3.5" /> انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                    {item.status === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="text-blue-600 hover:bg-blue-50 gap-1">
                          <Edit2 className="h-4 w-4" /> ویرایش
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(item.id)} className="text-red-600 hover:text-red-700 gap-1">
                          <Trash2 className="h-4 w-4" /> لغو
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

