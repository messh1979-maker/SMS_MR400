import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, Trash2, Trash } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { faDigits } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import type { SentEntry } from "@/lib/types";

export default function HistoryPage() {
  const [active, setActive] = useState<SentEntry[]>([]);
  const [archived, setArchived] = useState<SentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; permanent: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, ar] = await Promise.all([
        apiRequest<{ entries: SentEntry[] }>("/api/history?status=active"),
        apiRequest<{ entries: SentEntry[] }>("/api/history?status=archived"),
      ]);
      setActive(Array.isArray(a.entries) ? a.entries : []);
      setArchived(Array.isArray(ar.entries) ? ar.entries : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در دریافت تاریخچه", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const patch = useCallback(async (id: number, status: string, permanent = false) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/history/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, permanent }),
      });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا", true);
    } finally {
      setBusyId(null);
    }
  }, []);

  function renderRow(entry: SentEntry, kind: "active" | "archived") {
    return (
      <div key={entry.id} className="rounded-lg border bg-card p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="fa-nums font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr">
            {faDigits(entry.phone)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">{new Date(entry.sent_at).toLocaleString("fa-IR")}</span>
            {kind === "active" ? (
              <>
                <Button size="sm" variant="ghost" className="gap-1 text-blue-600 hover:bg-blue-50" onClick={() => patch(entry.id, "archived")} disabled={busyId === entry.id}>
                  <Archive className="h-4 w-4" /> آرشیو
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget({ id: entry.id, permanent: false })} disabled={busyId === entry.id}>
                  <Trash2 className="h-4 w-4" /> حذف
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="gap-1 text-emerald-600 hover:bg-emerald-50" onClick={() => patch(entry.id, "active")} disabled={busyId === entry.id}>
                  <ArchiveRestore className="h-4 w-4" /> بازیابی
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget({ id: entry.id, permanent: true })} disabled={busyId === entry.id}>
                  <Trash className="h-4 w-4" /> حذف قطعی
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap text-slate-900 dark:text-slate-100">{entry.message}</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <h2 className="text-2xl font-bold">تاریخچه پیامک‌های ارسالی</h2>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/50" />)}</div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-200">
              <Archive className="h-4 w-4 text-blue-500" />
              پیامک‌های فعال
              <span className="fa-nums rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted-foreground dark:bg-slate-800">
                {faDigits(active.length)}
              </span>
            </h3>
            {active.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">سابقه‌ای یافت نشد.</p>
            ) : (
              active.map((e) => renderRow(e, "active"))
            )}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-700 dark:text-slate-200">
              <ArchiveRestore className="h-4 w-4 text-amber-500" />
              پیامک‌های آرشیو شده
              <span className="fa-nums rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {faDigits(archived.length)}
              </span>
            </h3>
            {archived.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">مورد آرشیو شده‌ای وجود ندارد.</p>
            ) : (
              archived.map((e) => renderRow(e, "archived"))
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.permanent ? "حذف قطعی رکورد" : "حذف رکورد"}
        description={
          deleteTarget?.permanent
            ? "این رکورد برای همیشه از فایل لاگ پاک می‌شود و قابل بازگشت نیست."
            : "این رکورد حذف می‌شود و از فهرست پیامک‌های فعال خارج می‌شود."
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          await patch(deleteTarget.id, "deleted", deleteTarget.permanent);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
        busy={busyId !== null}
        busyLabel="در حال حذف..."
      />
    </div>
  );
}