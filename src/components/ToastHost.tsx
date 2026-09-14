import { useEffect, useState } from "react";
import { AlertTriangle, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToast, type ToastItem } from "@/lib/toast";

export default function ToastHost() {
  const [toast, setToast] = useState<ToastItem | null>(null);

  useEffect(() => subscribeToast(setToast), []);

  if (!toast) return null;
  return (
    <div
      className={cn(
        "toast fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-2xl",
        toast.error ? "bg-destructive" : "bg-slate-900 dark:bg-slate-800"
      )}
    >
      {toast.error ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CheckCheck className="h-4 w-4 text-emerald-400" />
      )}
      {toast.text}
    </div>
  );
}