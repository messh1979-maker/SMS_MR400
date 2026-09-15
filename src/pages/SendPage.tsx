import { useEffect, useMemo, useState } from "react";
import { Send, CheckCheck, Clock, Calendar, FileText, Loader2, Users } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MobilePreview from "@/components/MobilePreview";
import { faDigits, countSmsParts } from "@/lib/format";
import { normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SendPrefill, Template } from "@/lib/types";
import DatePicker from "react-multi-date-picker";
import persianFa from "react-date-object/locales/persian_fa";
import persian from "react-date-object/calendars/persian";

const VARIABLES = [
  { label: "نام", tag: "{نام}" },
  { label: "نام خانوادگی", tag: "{نام خانوادگی}" },
  { label: "کد ملی", tag: "{کدملی}" },
  { label: "سلام", tag: "{سلام}" },
];

export default function SendPage({
  prefill,
  onConsumePrefill,
  onNavigate,
}: { prefill: SendPrefill | null; onConsumePrefill: () => void; onNavigate: (p: "contacts") => void }) {
  const [phone, setPhone] = useState(prefill?.mobile || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [maxRetries, setMaxRetries] = useState(3);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    if (prefill?.mobile) { setPhone(prefill.mobile); onConsumePrefill(); }
  }, [prefill, onConsumePrefill]);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await apiRequest<{ templates: Template[] }>("/api/templates");
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch { /* silent */ }
      finally { setTemplatesLoading(false); }
    }
    loadTemplates();
  }, []);

  const cleaned = useMemo(() => normalizeNumber(phone), [phone]);
  const validPhone = useMemo(() => /^09\d{9}$/.test(cleaned), [cleaned]);
  const counter = useMemo(() => countSmsParts(message), [message]);
  const parts = counter.parts;
  const overLimit = parts > 6;

  const resolvedMessage = useMemo(() => {
    let out = message;
    if (prefill?.first_name) out = out.replace(/\{نام\}/g, prefill.first_name);
    if (prefill?.last_name) out = out.replace(/\{نام خانوادگی\}/g, prefill.last_name);
    return out;
  }, [message, prefill]);

  const hasUnresolvedVars = useMemo(
    () => resolvedMessage.includes("{نام}") || resolvedMessage.includes("{نام خانوادگی}"),
    [resolvedMessage]
  );

  function applyTemplate(t: Template) {
    setMessage(t.body);
    showToast(`قالب "${t.title}" اعمال شد.`);
  }

  async function handleSend() {
    if (!validPhone || !message.trim()) {
      showToast(validPhone ? "متن پیام را بنویسید." : "شماره معتبر وارد کنید.", true);
      return;
    }
    if (hasUnresolvedVars) {
      showToast("متغیر {نام} یا {نام خانوادگی} در پیام باقی مانده. مخاطب را از دفترچه تلفن انتخاب کنید.", true);
      return;
    }
    if (overLimit) {
      showToast("طول پیام بیش از حد مجاز (۶ پیامک) است.", true);
      return;
    }

    if (scheduled) {
      if (!scheduleDate || !scheduleTime) {
        showToast("تاریخ و زمان ارسال را انتخاب کنید.", true);
        return;
      }
      const jalaliStr = `${scheduleDate} ${scheduleTime}`;
      setSending(true);
      try {
        await apiRequest("/api/send_scheduled", {
          method: "POST",
          body: JSON.stringify({ mobile: cleaned, message: resolvedMessage, scheduled_at: jalaliStr, max_retries: maxRetries }),
        });
        setSent(true);
        setMessage("");
        setScheduleDate(null);
        setScheduleTime("");
        showToast(`پیامک برای ${faDigits(cleaned)} در ${jalaliStr} زمان‌بندی شد.`);
        setTimeout(() => setSent(false), 2500);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "خطا در زمان‌بندی", true);
      } finally {
        setSending(false);
      }
    } else {
      setSending(true);
      setSent(false);
      try {
        await apiRequest("/api/send_sms", {
          method: "POST",
          body: JSON.stringify({ phone: cleaned, message: resolvedMessage }),
        });
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
  }

  const remainingChars = 160 * (parts > 0 ? parts : 1) - (parts > 1 ? (parts - 1) * 7 : 0) - message.length;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">ارسال پیامک جدید</h2>

      {/* Template Selector */}
      <BentoBox title="قالب‌های آماده" icon={FileText} className="mb-4">
        {templatesLoading ? (
          <div className="flex gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-32" />)}</div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">هیچ قالبی وجود ندارد. از تنظیمات قالب بسازید.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(t)}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                {t.title}
              </Button>
            ))}
          </div>
        )}
      </BentoBox>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium mb-1">شماره موبایل *</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 09123456789"
                className={cn("border", validPhone || !phone ? "border-gray-300" : "border-red-500")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("contacts")}
                className="gap-1.5 whitespace-nowrap"
                title="انتخاب شماره از دفترچه تلفن"
              >
                <Users className="h-4 w-4" />
                مخاطب
              </Button>
            </div>
            {!validPhone && phone && <p className="text-xs text-red-500 mt-1">شماره موبایل معتبر نیست</p>}
          </div>

          <div>
            <Label className="block text-sm font-medium mb-1">متن پیام *</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              dir="rtl"
              style={{ background: "var(--card)", color: "var(--foreground)" }}
              className="w-full p-2 rounded-md border border-gray-300 placeholder:text-muted-foreground"
              placeholder="متن پیام خود را اینجا بنویسید..."
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{parts} بخش (پارت)</span>
              <span className={overLimit ? "text-red-500" : ""}>
                {overLimit ? "محدودیت ۶ بخش" : `${remainingChars} کاراکتر باقی‌مانده`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button
                key={v.tag}
                type="button"
                onClick={() => setMessage((prev) => prev + v.tag)}
                className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Schedule Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10">
            <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
            <Label className="flex items-center gap-2 cursor-pointer font-medium text-slate-900 dark:text-slate-100">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(e) => setScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>ارسال زمان‌بندی‌شده</span>
            </Label>
          </div>

          {scheduled && (
            <div className="grid gap-4 sm:grid-cols-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 animate-fade-in">
              <div>
                <Label className="block text-sm font-medium mb-1">
                  تاریخ شمسی *
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <DatePicker
                    value={scheduleDate}
                    onChange={(date) => setScheduleDate(date ? date.format("YYYY/MM/DD") : null)}
                    format="YYYY/MM/DD"
                    calendar={persian}
                    locale={persianFa}
                    inputClass="pl-10 pr-4 font-mono text-slate-900 dark:text-slate-100"
                    placeholder="انتخاب تاریخ"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="scheduleTime" className="block text-sm font-medium mb-1">
                  زمان *
                </Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1">
                  تعداد تلاش مجدد *
                </Label>
                <select
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  className="w-full p-2 rounded-md border border-gray-300 bg-white dark:bg-slate-800 dark:text-slate-100 font-mono text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "بار" : "بار"}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                زمان مطابق ساعت تهران (UTC+3:30) ثبت می‌شود. در صورت ناموفق بودن ارسال، برنامه تا {maxRetries} بار دوباره تلاش خواهد کرد.
              </p>
            </div>
          )}

          <Button onClick={handleSend} disabled={sending || !validPhone || !message.trim() || overLimit || (scheduled && (!scheduleDate || !scheduleTime))} className="w-full gap-2">
            {sending ? (
              <>در حال ارسال... <Loader2 className="h-4 w-4 animate-spin" /></>
            ) : sent ? (
              <>پیامک ارسال شد <CheckCheck className="h-4 w-4 ml-2" /></>
            ) : scheduled ? (
              <>زمان‌بندی <Clock className="h-4 w-4 ml-2" /></>
            ) : (
              <>ارسال پیامک <Send className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </div>

        <div className="lg:sticky lg:top-6">
          {prefill?.first_name || prefill?.last_name ? (
            <p className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
              مخاطب: {prefill.first_name} {prefill.last_name} — متغیرهای {`{نام}`} و {`{نام خانوادگی}`} به‌صورت خودکار جایگزین می‌شوند.
            </p>
          ) : null}
          <MobilePreview phone={cleaned || "09xxxxxxxxx"} message={resolvedMessage || "پیش‌نمایش پیام شما در اینجا نمایش داده می‌شود..."} parts={parts} />
        </div>
      </div>
    </div>
  );
}