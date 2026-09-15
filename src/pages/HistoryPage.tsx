import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";

interface HistoryEntry { phone: string; message: string; sent_at: string; }

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"phone" | "sent_at">("sent_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: "phone" | "sent_at") {
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
    setSortKey(key);
  }

  const sortedHistory = [...history].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : -String(av).localeCompare(String(bv));
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiRequest<{ entries: HistoryEntry[] }>("/api/history");
        setHistory(data.entries || []);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "خطا در دریافت تاریخچه", true);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">تاریخچه پیامک‌های ارسالی</h2>
      <div className="grid gap-1 text-xs font-bold text-muted-foreground sm:grid-cols-2">
        <span
          className="cursor-pointer select-none hover:text-foreground"
          onClick={() => toggleSort("phone")}
        >
          شمارهٔ تلفن{sortKey === "phone" ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
        <span
          className="cursor-pointer select-none hover:text-foreground"
          onClick={() => toggleSort("sent_at")}
        >
          زمان ارسال{sortKey === "sent_at" ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
      </div>
      <div className="space-y-3">
        {sortedHistory.length === 0 ? <p className="text-center text-gray-500 py-8">سابقه‌ای یافت نشد.</p> : sortedHistory.map((entry, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-card">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>{entry.phone}</span>
              <span>{new Date(entry.sent_at).toLocaleString("fa-IR")}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
