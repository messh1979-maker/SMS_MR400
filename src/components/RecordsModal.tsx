import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Modal from "@/components/Modal";
import Skeleton from "@/components/Skeleton";
import { faDigits } from "@/lib/format";

export default function RecordsModal<T extends { id?: number | string }>({
  open,
  onClose,
  title,
  icon: Icon,
  load,
  render,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  load: () => Promise<T[]>;
  render: (row: T, index: number) => ReactNode;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div dir="rtl" className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="fa-nums">{faDigits(rows.length)} رکورد</span>
        </div>
        <div className="custom-scrollbar max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain pe-1">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">رکوردی یافت نشد.</p>
          ) : (
            rows.map((row, i) => (
              <div key={row.id ?? i} className="rounded-xl border bg-card p-3 dark:border-white/5">
                {render(row, i)}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}