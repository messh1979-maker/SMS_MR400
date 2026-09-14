import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, User, LayoutDashboard, Send, Users, History, Inbox, Settings, X } from "lucide-react";
import type { Contact, PageId } from "@/lib/types";
import { faDigits } from "@/lib/format";
import { getCategory } from "@/lib/sms";
import { cn } from "@/lib/utils";

const PAGES: { id: PageId; label: string; icon: typeof Send }[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "send", label: "ارسال پیامک", icon: Send },
  { id: "inbox", label: "صندوق دریافت", icon: Inbox },
  { id: "history", label: "تاریخچه و لاگ", icon: History },
  { id: "contacts", label: "مخاطبین", icon: Users },
  { id: "settings", label: "تنظیمات و API", icon: Settings },
];

export default function CommandPalette({
  open,
  onClose,
  contacts,
  onNavigate,
  onPickContact,
}: {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  onNavigate: (p: PageId) => void;
  onPickContact: (contact: Contact) => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pages = PAGES.map((p) => ({ type: "page" as const, ...p }));
    const contactsList = contacts.map((c) => ({ type: "contact" as const, contact: c }));
    const results: Array<
      { type: "page"; id: PageId; label: string; icon: typeof Send } | { type: "contact"; contact: Contact }
    > = [];
    if (!query) {
      results.push(...pages);
      return results;
    }
    const qF = query.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    results.push(...pages.filter((p) => p.label.includes(query)));
    results.push(
      ...contactsList
        .filter((c) => {
          const raw = c.contact.number.replace(/[^\d]/g, "");
          return raw.includes(qF.replace(/\D/g, "")) || String(c.contact.number).includes(qF);
        })
        .slice(0, 6)
        .map((c) => ({ type: "contact" as const, contact: c.contact }))
    );
    return results.length ? results : pages;
  }, [q, contacts]);

  useEffect(() => setIdx(0), [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        const item = items[idx];
        if (item) run(item);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items, idx]);

  function run(item: (typeof items)[number]) {
    if (item.type === "page") {
      onNavigate(item.id);
    } else {
      onPickContact(item.contact);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-sm">
      <div className="fade-in-up w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-slate-900">
        <div dir="rtl" className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جست‌وجوی صفحه یا شماره... (Ctrl+K)"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-900 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">نتیجه‌ای پیدا نشد.</p>
          )}
          {items.map((item, i) => {
            const selected = i === idx;
            if (item.type === "page") {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => run(item)}
                  onMouseMove={() => setIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    selected
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-right">انتقال به: {item.label}</span>
                  {selected && <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />}
                </button>
              );
            }
            const cat = getCategory(item.contact.number);
            return (
              <button
                key={item.contact.number}
                onClick={() => run(item)}
                onMouseMove={() => setIdx(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  selected ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white", cat.avatar)}>
                  <User className="h-3.5 w-3.5" />
                </span>
                <span className="flex flex-1 flex-col items-start">
                  <span className="text-left font-medium" dir="ltr">{faDigits(item.contact.number)}</span>
                  <span className={cn("text-[11px]", selected ? "text-white/70" : "text-muted-foreground")}>
                    {cat.label} · {faDigits(item.contact.received + item.contact.sent)} پیام
                  </span>
                </span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", selected ? "bg-white/20" : cat.pill)}>
                  ارسال
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}