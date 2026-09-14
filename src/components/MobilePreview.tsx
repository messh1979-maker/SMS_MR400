import { faDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function MobilePreview({
  phone,
  message,
  parts,
  className,
}: {
  phone: string;
  message: string;
  parts: number;
  className?: string;
}) {
  return (
    <div
      dir="rtl"
      className={cn(
        "mx-auto w-full max-w-[260px] rounded-[2rem] border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-xl shadow-slate-900/30 dark:border-white/15",
        className
      )}
    >
      <div className="flex items-center justify-between rounded-t-[1.5rem] bg-slate-900 px-3 py-1.5">
        <div className="h-1 w-10 rounded-full bg-slate-800/70" />
        <div className="h-1.5 w-12 rounded-full bg-slate-800/70" />
        <div className="h-1 w-4 rounded-full bg-slate-800/70" />
      </div>
      <div className="rounded-b-[1.5rem] bg-gradient-to-b from-slate-100 to-white px-3 pb-4 pt-3 dark:from-slate-800 dark:to-slate-900">
        <div className="mb-2 text-center text-[10px] font-semibold text-slate-400">
          {phone ? faDigits(phone) : "پیامک جدید"}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="w-1/2 rounded-2xl rounded-bl-md bg-slate-200 py-3 dark:bg-slate-700/60" />
          {message ? (
            <div className="max-w-[85%] self-end rounded-2xl rounded-br-md rounded-tl-2xl bg-emerald-500 px-3 py-2 text-[11px] leading-5 text-white shadow-sm">
              <span className="whitespace-pre-line break-words">{message}</span>
              <div className="mt-1 flex justify-end gap-1 text-[9px] text-emerald-100/70">
                <span>✓✓</span>
                <span>{parts > 1 ? `‏${faDigits(parts)}‏` : ""}</span>
              </div>
            </div>
          ) : (
            <div className="max-w-[85%] self-end rounded-2xl rounded-br-md rounded-tl-2xl bg-emerald-500 px-3 py-2.5 text-[11px] text-emerald-100/80">
              پیش‌نمایش پیام شما
            </div>
          )}
        </div>
        {parts > 1 && (
          <div className="mt-2 text-center text-[10px] text-slate-400">
            به دلیل طول پیام، ارسال در {faDigits(parts)} پیامک انجام می‌شود.
          </div>
        )}
      </div>
    </div>
  );
}