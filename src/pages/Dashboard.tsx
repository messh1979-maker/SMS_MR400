import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  Inbox,
  Send,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";
import BarChart from "@/components/BarChart";
import BentoBox from "@/components/BentoBox";
import RecordsModal from "@/components/RecordsModal";
import Skeleton from "@/components/Skeleton";
import { getCategoryMeta } from "@/lib/categories";
import { apiRequest } from "@/lib/api";
import { useCachedThenRefresh } from "@/lib/hooks";
import { faDigits, formatTime } from "@/lib/format";
import type { ActivityPoint, PageId, SmsMessage, ScheduledSms, SentEntry, StatsData, SmsCounts, SwrMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

function useDashboard(nonce: number) {
  const stats = useCachedThenRefresh<StatsData & SwrMeta>(
    useCallback((force) => apiRequest<StatsData & SwrMeta>(force ? "/api/stats?refresh=1" : "/api/stats"), [])
  );
  const inbox = useCachedThenRefresh<{ messages?: SmsMessage[] } & SwrMeta>(
    useCallback((force) => apiRequest<{ messages?: SmsMessage[] } & SwrMeta>(force ? "/api/inbox?refresh=1" : "/api/inbox"), [])
  );
  const activity = useCachedThenRefresh<{ series?: ActivityPoint[] } & SwrMeta>(
    useCallback((force) => apiRequest<{ series?: ActivityPoint[] } & SwrMeta>(force ? "/api/activity?days=7&refresh=1" : "/api/activity?days=7"), [])
  );

  const [counts, setCounts] = useState<SmsCounts>({ pending: 0, failed: 0 });
  useEffect(() => {
    apiRequest<SmsCounts>("/api/sms_counts")
      .then(setCounts)
      .catch(() => { /* silent */ });
  }, []);

  // تازه‌سازی اجباری هنگام کلیک «به‌روزرسانی» در Topbar (غیرچرخه‌ای؛ فقط با nonce)
  const refreshRef = useRef<Array<() => void>>([]);
  refreshRef.current = [stats.refresh, inbox.refresh, activity.refresh];
  useEffect(() => {
    if (nonce > 0) refreshRef.current.forEach((fn) => fn());
  }, [nonce]);

  const recent = (inbox.data?.messages ?? []).slice(0, 12);
  return {
    stats,
    inbox,
    activity,
    counts,
    recent,
    receivedTotal: stats.data?.received.total ?? 0,
    sentTotal: stats.data?.sent.total ?? 0,
    sentToday: (activity.data?.series ?? []).filter((a) => a.sent > 0).reduce((s, a) => s + a.sent, 0),
    updating: stats.stale || inbox.stale || activity.stale,
  };
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  color,
  onClick,
}: {
  icon: typeof Send;
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  color: string;
  onClick?: () => void;
}) {
  return (
    <BentoBox className={cn("relative overflow-hidden", onClick && "transition-transform hover:scale-[1.01] active:scale-[0.99]")}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="block w-full text-right disabled:cursor-default"
        aria-label={onClick ? `مشاهده جزئیات ${label}` : undefined}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="fa-nums text-[28px] font-bold leading-none text-slate-900 dark:text-slate-100">
                  {value}
                </p>
              )}
              {sub && !loading ? (
                <span className="mt-1 text-[13px] font-medium text-muted-foreground">{sub}</span>
              ) : null}
            </div>
          </div>
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", color)}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </button>
    </BentoBox>
  );
}

export default function Dashboard({ onNavigate, refreshNonce }: { onNavigate: (p: PageId) => void; refreshNonce?: number }) {
  const d = useDashboard(refreshNonce ?? 0);
  const [modal, setModal] = useState<{
    title: string;
    icon: typeof Send;
    load: () => Promise<Array<{ id?: number | string }>>;
    render: (row: { id?: number | string }, index: number) => JSX.Element;
  } | null>(null);

  return (
    <div dir="rtl" className="fade-in-up grid gap-4 lg:grid-cols-3">
      {/* کاشی‌های آماری */}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
        <StatTile
          icon={Inbox}
          label="پیامک‌های وارده"
          value={faDigits(d.receivedTotal)}
          sub={d.inbox.data ? `${faDigits(d.inbox.data.messages?.length ?? 0)} در صندوق` : undefined}
          loading={d.stats.loading}
          color="bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300"
          onClick={() => setModal({
            title: "پیامک‌های دریافتی",
            icon: Inbox,
            load: async () => (await apiRequest<{ messages: SmsMessage[] }>("/api/inbox")).messages,
            render: (row) => {
              const m = row as SmsMessage;
              return <div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="fa-nums font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr">{faDigits(m.sender)}</span>
                  <span>{formatTime(m.received_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-slate-700 dark:text-slate-300">{m.content}</p>
              </div>;
            },
          })}
        />
        <StatTile
          icon={CheckCheck}
          label="ارسال‌شده (کل)"
          value={faDigits(d.sentTotal)}
          sub={d.sentToday > 0 ? `امروز: ${faDigits(d.sentToday)} پیامک` : "امروز ارسالی نداشتید"}
          loading={d.stats.loading}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
          onClick={() => setModal({
            title: "پیامک‌های ارسال‌شده",
            icon: CheckCheck,
            load: async () => (await apiRequest<{ entries: SentEntry[] }>("/api/history?status=active")).entries,
            render: (row) => {
              const e = row as SentEntry;
              return <div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="fa-nums font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr">{faDigits(e.phone)}</span>
                  <span>{new Date(e.sent_at).toLocaleString("fa-IR")}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-slate-700 dark:text-slate-300">{e.message}</p>
              </div>;
            },
          })}
        />
        <StatTile
          icon={Clock}
          label="ارسال نشده"
          value={faDigits(d.counts.pending)}
          sub="زمان‌بندی‌های در انتظار"
          loading={d.stats.loading}
          color="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
          onClick={() => setModal({
            title: "زمان‌بندی‌های در انتظار",
            icon: Clock,
            load: async () => (await apiRequest<{ scheduled: ScheduledSms[] }>("/api/scheduled?status=pending")).scheduled,
            render: (row) => {
              const s = row as ScheduledSms;
              return <div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="fa-nums font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr">{faDigits(s.mobile)}</span>
                  <span>{new Date(s.scheduled_at_utc).toLocaleString("fa-IR")}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-slate-700 dark:text-slate-300">{s.message}</p>
              </div>;
            },
          })}
        />
        <StatTile
          icon={AlertTriangle}
          label="ارسال ناموفق"
          value={faDigits(d.counts.failed)}
          sub="زمان‌بندی‌های شکست خورده"
          loading={d.stats.loading}
          color="bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300"
          onClick={() => setModal({
            title: "ارسال‌های ناموفق",
            icon: AlertTriangle,
            load: async () => (await apiRequest<{ scheduled: ScheduledSms[] }>("/api/scheduled?status=failed")).scheduled,
            render: (row) => {
              const s = row as ScheduledSms;
              return <div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="fa-nums font-mono font-medium text-slate-700 dark:text-slate-200" dir="ltr">{faDigits(s.mobile)}</span>
                  <span>تلاش {faDigits(s.retries)}/{faDigits(s.max_retries)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] text-slate-700 dark:text-slate-300">{s.message}</p>
              </div>;
            },
          })}
        />
      </div>

      {/* نمودار */}
      <BentoBox title="فعالیت ۷ روز اخیر" icon={Activity} className="lg:col-span-2">
        <div className="mb-3 flex items-center gap-5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> پیامک‌های ارسالی
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> پیامک‌های دریافتی
          </span>
        </div>
        {(d.activity.data?.series?.length ?? 0) === 0 ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="w-full">
            <BarChart data={d.activity.data!.series!} />
          </div>
        )}
      </BentoBox>

      {/* اکشن‌های سریع */}
      <BentoBox title="ابزارهای سریع" icon={Send}>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onNavigate("send")}
            className="group flex items-center justify-between rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            ارسال پیامک جدید
            <Send className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
          </button>
          <button
            onClick={() => onNavigate("contacts")}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-300" /> مدیریت مخاطبین
            </span>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => onNavigate("history")}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-300" /> تاریخچه ارسال‌ها
            </span>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </BentoBox>

      {/* آخرین پیامک‌های دریافتی — اسکرول داخلی (Task 4) */}
      <BentoBox title="آخرین پیامک‌های دریافتی" icon={Inbox} className="lg:col-span-3">
        {d.inbox.loading || !d.inbox.data ? (
          <div className="flex flex-col gap-2 py-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : d.recent.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
            پیامک دریافتی‌ای ثبت نشده است.
          </div>
        ) : (
          <ul className="custom-scrollbar max-h-[400px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {d.recent.map((m) => {
              const cat = getCategoryMeta(m.category ?? "other");
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white",
                      cat.avatar
                    )}
                  >
                    {m.sender.slice(-2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                        {faDigits(m.sender)}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {formatTime(m.received_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[13px] leading-[1.6] text-slate-700 dark:text-slate-300">
                      {m.content}
                    </p>
                  </div>
                  {m.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </li>
              );
            })}
          </ul>
        )}
      </BentoBox>

      {modal && (
        <RecordsModal
          open
          onClose={() => setModal(null)}
          title={modal.title}
          icon={modal.icon}
          load={modal.load}
          render={modal.render}
        />
      )}
    </div>
  );
}