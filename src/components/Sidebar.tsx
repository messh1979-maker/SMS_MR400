import {
  History,
  LayoutDashboard,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Inbox,
  Users,
  Send,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageId } from "@/lib/types";

const NAV: { id: PageId; label: string; icon: typeof Send }[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "send", label: "ارسال پیامک", icon: Send },
  { id: "inbox", label: "صندوق دریافت", icon: Inbox },
  { id: "history", label: "تاریخچه و لاگ", icon: History },
  { id: "contacts", label: "مخاطبین", icon: Users },
  { id: "scheduled", label: "صف ارسال", icon: Clock },
  { id: "settings", label: "تنظیمات و API", icon: Settings },
];

export default function Sidebar({
  page,
  onNavigate,
  collapsed,
  onToggle,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      dir="rtl"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-l border-slate-200/70 bg-white/70 backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-900/60",
        collapsed ? "w-[68px]" : "w-[236px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 pb-5 pt-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <MessageSquareText className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">پیامک گیت‌وی</div>
            <div className="text-[11px] text-muted-foreground">Archer MR400</div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", !active && "opacity-80 group-hover:opacity-100")} />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-2.5 pb-4 pt-3">
        <button
          onClick={onToggle}
          title={collapsed ? "باز کردن منو" : "بستن منو"}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && <span>بستن منو</span>}
        </button>
        {!collapsed && (
          <p className="mt-2 px-3 text-[10px] leading-4 text-muted-foreground/70">
            نسخه ۲.۰ — پنل مدیریت پیامک
            <br />
            v{new Date().getFullYear()}
          </p>
        )}
      </div>
    </aside>
  );
}