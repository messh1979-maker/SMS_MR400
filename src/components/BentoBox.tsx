import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BentoBox({
  className,
  children,
  title,
  icon: Icon,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/5 dark:bg-slate-900/70 dark:hover:bg-slate-800/60",
        className
      )}
    >
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}