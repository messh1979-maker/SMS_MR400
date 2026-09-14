import { useEffect, useMemo, useState } from "react";
import { Send, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobilePreview from "@/components/MobilePreview";
import { faDigits, countSmsParts } from "@/lib/format";
import { normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";

const VARIABLES = [
  { label: "نام", tag: "{نام}" },
  { label: "نام خانوادگی", tag: "{نام خانوادگی}" },
  { label: "کد ملی", tag: "{کدملی}" },
  { label: "سلام", tag: "{سلام}" },
];

export default function SendPage({ prefillNumber, onConsumePrefill }: { prefillNumber: string | null; onConsumePrefill: () => void }) {
  const [phone, setPhone] = useState(prefillNumber || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (prefillNumber) { setPhone(prefillNumber); onConsumePrefill(); }
  }, [prefillNumber, onConsumePrefill]);

  const cleaned = useMemo(() => normalizeNumber(phone), [phone]);
  const validPhone = useMemo(() => /^09\d{9}$/.test(cleaned), [cleaned]);
  const counter = useMemo(() => countSmsParts(message), [message]);
  const parts = counter.parts;
  const overLimit = parts > 6;

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
      await apiRequest("/api/send_sms", {
        method: "POST",
        body: JSON.stringify({ phone: cleaned, message }),
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">ارسال پیامک جدید</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">شماره موبایل</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="مثال: 09123456789" className={`w-full p-2 rounded-md border ${validPhone || !phone ? "border-gray-300" : "border-red-500"}`} />
            {!validPhone && phone && <p className="text-xs text-red-500 mt-1">شماره موبایل معتبر نیست</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">متن پیام</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="w-full p-2 rounded-md border border-gray-300" placeholder="متن پیام خود را اینجا بنویسید..." />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{parts} بخش (پارت)</span>
              <span className={overLimit ? "text-red-500" : ""}>{overLimit ? "محدودیت ۶ بخش" : `${160 * (parts > 0 ? parts : 1) - (parts > 1 ? (parts - 1) * 7 : 0) - message.length} کاراکتر باقی‌مانده`}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button key={v.tag} type="button" onClick={() => setMessage((prev) => prev + v.tag)} className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">{v.label}</button>
            ))}
          </div>
          <Button onClick={handleSend} disabled={sending || !validPhone || !message.trim() || overLimit} className="w-full">
            {sending ? "در حال ارسال..." : sent ? <><CheckCheck className="w-4 h-4 ml-2" /> ارسال شد</> : <><Send className="w-4 h-4 ml-2" /> ارسال پیامک</>}
          </Button>
        </div>
        <div className="lg:sticky lg:top-6">
          <MobilePreview phone={cleaned || "09xxxxxxxxx"} message={message || "پیش‌نمایش پیام شما در اینجا نمایش داده می‌شود..."} parts={parts} />
        </div>
      </div>
    </div>
  );
}
