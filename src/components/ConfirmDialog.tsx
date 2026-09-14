import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfirmDialog({
  open,
  title,
  description,
  countLabel,
  onConfirm,
  onCancel,
  busy,
  busyLabel = "در حال انجام...",
}: {
  open: boolean;
  title: string;
  description: string;
  countLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  busyLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="fade-in-up w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl shadow-black/20 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-2.5 dark:bg-red-950/60">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold">{title}</h3>
            {countLabel && <p className="text-xs text-muted-foreground">{countLabel}</p>}
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            انصراف
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {busy ? busyLabel : "تأیید"}
          </Button>
        </div>
      </div>
    </div>
  );
}