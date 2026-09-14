const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function faDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function formatDayShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { weekday: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function countSmsParts(text: string): { chars: number; parts: number } {
  const chars = [...text].length;
  if (chars === 0) return { chars: 0, parts: 0 };
  const unicode = [...text].some((c) => c.charCodeAt(0) > 127);
  let parts: number;
  if (unicode) {
    parts = chars <= 70 ? 1 : Math.ceil(chars / 67);
  } else {
    parts = chars <= 160 ? 1 : Math.ceil(chars / 153);
  }
  return { chars, parts };
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}