import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Inbox, RefreshCw, Search, Trash2, Square, X } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import ConfirmDialog from "@/components/ConfirmDialog";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { getCategoryMeta } from "@/lib/categories";
import { faDigits, formatTime } from "@/lib/format";
import { getCategory, normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import type { SmsMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<{ messages: SmsMessage[] }>("/api/inbox");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      showToast("خطا در دریافت صندوق", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const q = normalizeNumber(search);
    const filtered = q
      ? messages.filter((m) => m.sender.includes(q) || m.content.includes(search))
      : messages;
    const map = new Map<string, SmsMessage[]>();
    for (const m of filtered) {
      const id = m.category || getCategory(m.sender).id;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(m);
    }
    return [...map.entries()];
  }, [messages, search]);

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === messages.length) return new Set();
      return new Set(messages.map((m) => m.id));
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await apiRequest("/api/sms", { method: "DELETE", body: JSON.stringify({ ids: [...selected] }) });
      showToast(`${faDigits(selected.size)} پیامک حذف شد.`);
      setSelected(new Set());
      setConfirmOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در حذف", true);
    } finally {
      setDeleting(false);
    }
  }

  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div dir="rtl" className="fade-in-up space-y-4">
      <BentoBox className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setSearch("");
              }}
              placeholder="جست‌وجو بر اساس شماره یا متن..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="پاک‌کردن جست‌وجو"
                className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5 text-xs">
            {selected.size === messages.length && messages.length > 0 ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            انتخاب همه
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={selected.size === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            حذف ({faDigits(selected.size)})
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            تازه‌سازی
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {faDigits(messages.length)} پیامک در صندوق · {faDigits(unreadCount)} خوانده‌نشده
        </p>
      </BentoBox>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <BentoBox key={i}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            </BentoBox>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <BentoBox className="py-10 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">پیامکی در صندوق نیست.</p>
        </BentoBox>
      ) : (
        <div className="custom-scrollbar max-h-[calc(100vh-15rem)] space-y-4 overflow-y-auto overscroll-contain pe-1">
{grouped.map(([catId, items]) => {
          const cat = getCategoryMeta(catId);
          const Icon = cat.icon;
          return (
        <div key={catId} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className={cn("h-2 w-2 rounded-full", cat.dot)} />
              <Icon className={cn("h-3.5 w-3.5", cat.iconColor)} />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{cat.label}</h3>
              <span className="fa-nums text-[12px] font-medium text-muted-foreground">{faDigits(items.length)}</span>
            </div>
            {items.map((m) => {
              const checked = selected.has(m.id);
              const isOpen = expanded === m.id;
              return (
                <BentoBox
                  key={m.id}
                  className={cn(
                    "py-3",
                    m.unread && "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-950/30",
                    checked && "border-blue-300 bg-blue-100/70 dark:border-blue-400/40 dark:bg-blue-900/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleOne(m.id)}
                      aria-label="انتخاب پیامک"
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                        checked
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-400 bg-white text-transparent hover:border-blue-500 hover:bg-blue-50 dark:border-slate-500 dark:bg-slate-900 dark:hover:border-blue-400 dark:hover:bg-blue-950/40"
                      )}
                    >
                      {checked && <CheckSquare className="h-3.5 w-3.5" />}
                    </button>
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white",
                        cat.avatar
                      )}
                    >
                      {m.sender.slice(-2)}
                    </span>
                    <button
                      className="min-w-0 flex-1 text-right"
                      onClick={() => (expanded === m.id ? setExpanded(null) : setExpanded(m.id))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="fa-nums text-sm font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                          {faDigits(m.sender)}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {formatTime(m.received_at)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-1 text-[13px] leading-[1.6]",
                          isOpen ? "" : "line-clamp-1",
                          m.unread ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {m.content}
                      </p>
                    </button>
                    {m.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                  {isOpen && (
                    <div className="mr-20 mt-2 rounded-xl bg-slate-100/80 p-3 text-[13px] leading-[1.6] text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                      <p className="whitespace-pre-line">{m.content}</p>
                    </div>
                  )}
                </BentoBox>
              );
            })}
          </div>
          );
        })}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="حذف پیامک‌ها"
        description={`آیا از حذف ${faDigits(selected.size)} پیامک انتخاب‌شده مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        countLabel={`${faDigits(selected.size)} پیامک`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        busy={deleting}
        busyLabel="در حال حذف..."
      />
    </div>
  );
}