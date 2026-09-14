import { useEffect, useMemo, useRef, useState } from "react";
import { Send, CheckCheck, User, Zap, MessageSquareText, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobilePreview from "@/components/MobilePreview";
import BentoBox from "@/components/BentoBox";
import { faDigits, countSmsParts } from "@/lib/format";
import { getCategory, normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const VARIABLES = [
  { label: "نام", tag: "{نام}" },
  { label: "نام خانوادگی", tag: "{نام خانوادگی}" },
  { label: "کد ملی", tag: "{کدملی}" },
  { label: "سلام", tag: "{سلام}" },
];

const API = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000"}`;

export default function SendPage({
  prefillNumber,
  onConsumePrefill,
}: {
  prefillNumber: string | null;
  onConsumePrefill: () => void;
}) {
  const [phone, setPhone] = useState(prefillNumber ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefillNumber) {
      setPhone(prefillNumber);
      onConsumePrefill();
    }
  }, [prefillNumber, onConsumePrefill]);

  const cleaned = useMemo(() => normalizeNumber(phone), [phone]);
  const cat = useMemo(() => getCategory(phone), [phone]);
  const counter = useMemo(() => countSmsParts(message), [message]);
  const validPhone = cleaned && /^09\d{9}$|^0\d{9}$/.test(cleaned);
  const overLimit = counter.parts > 6;

  function insertVariable(tag: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + tag + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  async function handleSend() {
    if (!validPhone || !message.trim()) {
      showToast(validPhone ? "متن پیام را بنویسید." : "شماره معتبر وارد کنید.", true);
      return;
    }
    if (overLimit) {
      showToast("طول پیام بیش از حد مجاز (۶ پیامک) است.", true);
      return;
    }
    setSending(true);
    setSent(false);
    try {
      const res = await fetch(`${API}/api/send_sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "ارسال ناموفق بود");
      }
      setSent(true);
      setMessage("");
      showToast(`پیامک به ${faDigits(cleaned)} ارسال شد.`);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در ارتباط با سرور", true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div dir="rtl" className="fade-in-up grid gap-4 lg:grid-cols-5">
      {/* فرم ارسال */}
      <BentoBox title="ارسال پیامک" icon={Send} className="lg:col-span-3">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">شماره گیرنده</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxxx"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-input bg-white py-2.5 pl-3 pr-9 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/30 dark:bg-slate-900"
                />
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium", cat.pill)}>
                {cat.label}
              </span>
            </div>
            {phone && !validPhone && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                شماره باید با ۰۹ شروع شود (مثال: ۰۹۱۲۳۴۵۶۷۸۹)
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">متن پیامک</label>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  overLimit
                    ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                    : counter.parts > 1
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                )}
              >
                <Hash className="h-3 w-3" />
                {faDigits(counter.parts)} پیامک · {faDigits(counter.chars)} کاراکتر
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="متن پیامک خود را بنویسید..."
              className="w-full resize-none rounded-xl border border-input bg-white p-3 text-sm leading-7 outline-none transition-colors focus:ring-2 focus:ring-ring/30 dark:bg-slate-900"
            />
          </div>

          {/* متغیرهای سریع */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-blue-500" /> درج سریع:
            </span>
            {VARIABLES.map((v) => (
              <button
                key={v.tag}
                onClick={() => insertVariable(v.tag)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50"
              >
                {v.tag}
              </button>
            ))}
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !validPhone || !message.trim() || overLimit}
            className={cn(
              "w-full gap-2 rounded-xl py-3 text-sm font-bold shadow-lg transition-all",
              sent
                ? "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-500"
                : "bg-gradient-to-l from-blue-600 to-indigo-600 shadow-blue-600/30 hover:from-blue-700 hover:to-indigo-700"
            )}
          >
            {sending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                در حال ارسال...
              </>
            ) : (
              <>
                {sent ? <CheckCheck className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
                {sent ? "ارسال شد!" : "ارسال پیامک"}
              </>
            )}
          </Button>
        </div>
      </BentoBox>

      {/* پیش‌نمایش موبایل */}
      <BentoBox title="پیش‌نمایش موبایل" icon={MessageSquareText} className="lg:col-span-2">
        <MobilePreview phone={phone} message={message} parts={counter.parts} />
        <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
          متن بالا بر اساس مقدار سیم‌کارت داخلی مودم به صورت تک‌تکه یا چندبخشی ارسال می‌شود.
        </p>
      </BentoBox>
    </div>
  );
}