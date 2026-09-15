import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BatteryCharging,
  CheckCheck,
  Inbox,
  Network,
  RefreshCw,
  Send,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";
import BarChart from "@/components/BarChart";
import BentoBox from "@/components/BentoBox";
import RecordsModal from "@/components/RecordsModal";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { getCategoryMeta } from "@/lib/categories";
import { apiRequest } from "@/lib/api";
import { faDigits, formatTime } from "@/lib/format";
import type { ActivityPoint, PageId, SmsMessage, ScheduledSms, SentEntry, StatsData, SmsCounts } from "@/lib/types";
import { cn } from "@/lib/utils";

type Status = {
  connected: boolean | null;
  router_host?: string;
  network_type?: string;
  signal_level?: number | null;
  sim_status?: string;
  unread_sms?: number;
};

function useDashboard() {
  const [status, setStatus] = useState<Status>({ connected: null });
  const [stats, setStats] = useState<StatsData | null>(null);
  const [counts, setCounts] = useState<SmsCounts>({ pending: 0, failed: 0 });
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [recent, setRecent] = useState<SmsMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const [s, st, a, inb, c] = await Promise.all([
        apiRequest<Status>("/api/status"),
        apiRequest<StatsData>("/api/stats"),
        apiRequest<{ series: ActivityPoint[] }>("/api/activity?days=7"),
        apiRequest<{ messages: SmsMessage[] }>("/api/inbox"),
        apiRequest<SmsCounts>("/api/sms_counts"),
      ]);
      setStatus({ ...s, connected: true });
      setStats(st);
      setCounts(c);
      setActivity(Array.isArray(a.series) ? a.series : []);
      const msgs = Array.isArray(inb.messages) ? inb.messages.slice(0, 6) : [];
      setRecent(msgs);
    } catch {
      setStatus((prev) => ({ ...prev, connected: false }));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { status, stats, counts, activity, recent, refreshing, reload: load };
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

export default function Dashboard({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const d = useDashboard();
  const [modal, setModal] = useState<{
    title: string;
    icon: typeof Send;
    load: () => Promise<Array<{ id?: number | string }>>;
    render: (row: { id?: number | string }, index: number) => JSX.Element;
  } | null>(null);

  const sentToday = d.activity.filter((a) => a.sent > 0).reduce((s, a) => s + a.sent, 0);
  const receivedTotal = d.stats?.received.total ?? 0;
  const sentTotal = d.stats?.sent.total ?? 0;

  return (
    <div dir="rtl" className="fade-in-up grid gap-4 lg:grid-cols-3">
      {/* هدر برند */}
      <div className="lg:col-span-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          سامانه مدیریت پیامکی
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          اداره برق و مخابرات - شرکت آب و فاضلاب خراسان رضوی
        </p>
      </div>

      {/* نوار وضعیت */}
      <BentoBox className="flex items-center justify-between gap-3 lg:col-span-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              d.status.connected === true
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                : d.status.connected === false
                  ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            )}
          >
            <Network className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold">
              {d.status.connected === null ? "در حال اتصال به مودم..." : d.status.connected ? "مودم متصل است" : "خطا در اتصال"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {d.status.network_type ? `${faDigits(d.status.network_type)} · سیگنال ${faDigits(d.status.signal_level ?? 0)}٪` : d.status.router_host ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex dark:bg-slate-800 dark:text-slate-300">
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
            سیم‌کارت: {faDigits(d.status.sim_status ?? "—")}
          </span>
          <Button size="sm" variant="outline" onClick={d.reload} disabled={d.refreshing} className="gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", d.refreshing && "animate-spin")} />
            تازه‌سازی
          </Button>
        </div>
      </BentoBox>

      {/* کاشی‌های آماری */}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
        <StatTile
          icon={Inbox}
          label="پیامک‌های وارده"
          value={faDigits(receivedTotal)}
          sub={`${faDigits(d.status.unread_sms ?? 0)} خوانده‌نشده`}
          loading={!d.stats}
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
          value={faDigits(sentTotal)}
          sub={sentToday > 0 ? `امروز: ${faDigits(sentToday)} پیامک` : "امروز ارسالی نداشتید"}
          loading={!d.stats}
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
          loading={!d.stats}
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
          loading={!d.stats}
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
        {d.activity.length === 0 ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <div className="w-full">
            <BarChart data={d.activity} />
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

      {/* آخرین پیامک‌های دریافتی */}
      <BentoBox title="آخرین پیامک‌های دریافتی" icon={Inbox} className="lg:col-span-3">
        {d.recent.length === 0 && !d.refreshing ? (
          <p className="py-6 text-center text-sm text-muted-foreground">پیامک دریافتی‌ای ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
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