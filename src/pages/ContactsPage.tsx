import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Send, Users } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { faDigits, formatTime } from "@/lib/format";
import { CATEGORIES, getCategory, normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const NAMES_KEY = "sms-contact-names";

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function ContactsPage({ onSendTo }: { onSendTo: (contact: Contact) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>(loadNames);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/contacts`);
      const data = await res.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch {
      showToast("خطا در دریافت مخاطبین", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const saveName = useCallback((number: string, name: string) => {
    setNames((prev) => {
      const next = { ...prev };
      const key = normalizeNumber(number);
      if (name.trim()) next[key] = name.trim();
      else delete next[key];
      localStorage.setItem(NAMES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const list = contacts.filter((c) => (filter === "all" ? true : getCategory(c.number).id === filter));
    list.sort((a, b) => b.received + b.sent - (a.received + a.sent));
    return list;
  }, [contacts, filter]);

  function commitEdit(number: string) {
    saveName(number, draftName);
    setEditing(null);
  }

  return (
    <div dir="rtl" className="fade-in-up space-y-4">
      <BentoBox className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <span className="fa-nums">همه ({faDigits(contacts.length)})</span>
          </button>
          {CATEGORIES.map((c) => {
            const n = contacts.filter((x) => getCategory(x.number).id === c.id).length;
            if (n === 0) return null;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === c.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
                {c.label} ({faDigits(n)})
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="mr-auto gap-1.5 text-xs">
          <Users className="h-4 w-4" />
          تازه‌سازی
        </Button>
      </BentoBox>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <BentoBox key={i}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </BentoBox>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <BentoBox className="py-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">مخاطبی در این دسته یافت نشد.</p>
        </BentoBox>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const cat = getCategory(c.number);
            const name = names[normalizeNumber(c.number)] ?? "";
            return (
              <BentoBox key={c.number} className="group transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-500/30">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
                      cat.avatar
                    )}
                  >
                    {name.slice(0, 1) || c.number.slice(-2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editing === c.number ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitEdit(c.number)}
                          placeholder="نام مخاطب..."
                          className="w-full rounded-lg border border-input bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900"
                        />
                        <button
                          onClick={() => commitEdit(c.number)}
                          className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white"
                        >
                          ذخیره
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                          {name || faDigits(c.number)}
                        </span>
                        <button
                          onClick={() => {
                            setEditing(c.number);
                            setDraftName(name);
                          }}
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-blue-600 group-hover:opacity-100 dark:hover:text-blue-300"
                          title="تغییر نام"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {!name && <span className="fa-nums mt-0.5 block text-[12px] text-muted-foreground" dir="ltr">{faDigits(c.number)}</span>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat.pill)}>
                        {cat.label}
                      </span>
                      <span className="fa-nums text-[12px] font-medium text-muted-foreground">
                        {faDigits(c.received)} دریافتی · {faDigits(c.sent)} ارسالی
                      </span>
                    </div>
                    {c.last_at && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        آخرین تماس: {formatTime(c.last_at)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onSendTo(c)}
                    className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-600 transition-all hover:bg-blue-600 hover:text-white dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
                    title="ارسال پیامک"
                  >
                    <Send className="h-4 w-4 -scale-x-100" />
                  </button>
                </div>
              </BentoBox>
            );
          })}
        </div>
      )}
    </div>
  );
}