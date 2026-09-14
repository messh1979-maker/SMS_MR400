import { useId } from "react";
import type { ActivityPoint } from "@/lib/types";
import { formatDayShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const W = 720;
const H = 236;
const PAD_X = 8;
const PAD_Y = 30;
const TOP = 16;

export default function AreaChart({ data, className }: { data: ActivityPoint[]; className?: string }) {
  const gid = useId();
  const max = Math.max(...data.map((d) => Math.max(d.sent, d.received)), 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y - TOP;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = (key: "sent" | "received") =>
    data
      .map((d, i) => `${PAD_X + i * step},${TOP + innerH - (d[key] / max) * innerH}`)
      .join(" ");

  const area = (key: "sent" | "received") =>
    `${PAD_X},${TOP + innerH} ${points(key)} ${PAD_X + (data.length - 1) * step},${TOP + innerH}`;

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}>
        داده‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full", className)} role="img" aria-label="نمودار فعالیت">
      <defs>
        <linearGradient id={`${gid}-sent`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`${gid}-recv`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <g className="text-slate-200 dark:text-slate-800">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={TOP + innerH - (f * innerH) / 1}
            y2={TOP + innerH - (f * innerH) / 1}
            stroke="currentColor"
            strokeDasharray="4 4"
          />
        ))}
      </g>

      <polygon points={area("sent")} fill={`url(#${gid}-sent)`} />
      <polygon points={area("received")} fill={`url(#${gid}-recv)`} />

      <polyline
        points={points("received")}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={points("sent")}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data.map((d, i) => {
        const x = PAD_X + i * step;
        const showLabel = data.length <= 8 || i % 2 === 0;
        return (
          <g key={d.date} className="text-slate-600 dark:text-slate-300">
            {showLabel && (
              <text
                x={x}
                y={H - 6}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="currentColor"
              >
                {formatDayShort(d.date)}
              </text>
            )}
            <circle
              cx={x}
              cy={TOP + innerH - (d.received / max) * innerH}
              r="3.5"
              fill="#38bdf8"
              stroke="#fff"
              strokeWidth="2"
              strokeOpacity="0.9"
            />
            <circle
              cx={x}
              cy={TOP + innerH - (d.sent / max) * innerH}
              r="3.5"
              fill="#2563EB"
              stroke="#fff"
              strokeWidth="2"
              strokeOpacity="0.9"
            />
          </g>
        );
      })}
    </svg>
  );
}