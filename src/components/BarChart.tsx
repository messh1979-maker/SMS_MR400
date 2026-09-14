import { useId } from "react";
import type { ActivityPoint } from "@/lib/types";
import { faDigits, formatDayShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 720;
const H = 128;
const PAD_X = 8;
const PAD_Y = 20;
const TOP = 14;
const BAR_W = 22;
const BAR_GAP = 5;
const LABEL_OFFSET = 4;

export default function BarChart({ data, className }: { data: ActivityPoint[]; className?: string }) {
  const gid = useId();
  const max = Math.max(...data.map((d) => Math.max(d.sent, d.received)), 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y - TOP;
  const groupW = data.length > 0 ? innerW / data.length : 0;

  const yFor = (v: number) => TOP + innerH - (v / max) * innerH;

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}>
        داده‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full", className)} role="img" aria-label="نمودار میله‌ای فعالیت">
      <defs>
        <linearGradient id={`${gid}-sent`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${gid}-recv`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <g className="text-slate-200 dark:text-slate-800">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={yFor(f * max)}
            y2={yFor(f * max)}
            stroke="currentColor"
            strokeDasharray="4 4"
          />
        ))}
      </g>

      {data.map((d, i) => {
        const baseX = PAD_X + i * groupW;
        const midX = baseX + groupW / 2;
        const recvX = midX - BAR_GAP / 2 - BAR_W;
        const sentX = midX + BAR_GAP / 2;
        const sentH = (d.sent / max) * innerH;
        const recvH = (d.received / max) * innerH;

        return (
          <g key={d.date}>
            <rect x={recvX} y={yFor(d.received)} width={BAR_W} height={recvH} rx="4" fill={`url(#${gid}-recv)`} />
            {d.received > 0 && (
              <text x={recvX + BAR_W / 2} y={yFor(d.received) - LABEL_OFFSET} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-blue-700 dark:fill-blue-300">
                {faDigits(d.received)}
              </text>
            )}
            <rect x={sentX} y={yFor(d.sent)} width={BAR_W} height={sentH} rx="4" fill={`url(#${gid}-sent)`} />
            {d.sent > 0 && (
              <text x={sentX + BAR_W / 2} y={yFor(d.sent) - LABEL_OFFSET} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-green-700 dark:fill-green-300">
                {faDigits(d.sent)}
              </text>
            )}
            <text
              x={midX}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              className="fill-slate-600 dark:fill-slate-300"
            >
              {formatDayShort(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}