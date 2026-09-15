import { useEffect, useState } from "react";
import { BookOpen, Cable, Globe, RefreshCw, Settings2, ShieldCheck, Plus, Trash2, FileText, PenLine, X } from "lucide-react";
import BentoBox from "@/components/BentoBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, BASE } from "@/lib/api";
import { faDigits } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/types";

const ENDPOINTS = [
  { method: "GET", path: "/api/status", desc: "وضعیت اتصال، شبکه و سیم‌کارت" },
  { method: "GET", path: "/api/inbox", desc: "لیست پیامک‌های دریافتی" },
  { method: "POST", path: "/api/send_sms", desc: "ارسال پیامک (شماره + متن)" },
  { method: "DELETE", path: "/api/sms", desc: "حذف گروهی پیامک‌ها (ids)" },
  { method: "GET", path: "/api/stats", desc: "آمار وارده/ارسال‌شده" },
  { method: "GET", path: "/api/activity", desc: "سری زمانی روزانه برای نمودار" },
  { method: "GET", path: "/api/contacts", desc: "مخاطبین استخراج‌شده" },
  { method: "GET", path: "/api/history", desc: "تاریخچه پیامک‌های ارسال‌شده" },
];

type Status = { connected: boolean; network_type?: string; signal_level?: number | null; sim_status?: string };

export default function SettingsPage() {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplTitle, setTplTitle] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplSaving, setTplSaving] = useState(false);
  const [tplSortKey, setTplSortKey] = useState<"title" | "created_at">("title");
  const [tplSortDir, setTplSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function testConnection() {
    setChecking(true);
    try {
      const data = await apiRequest<Status & { router_host?: string }>("/api/status");
      setStatus({ ...data, connected: true });
      setLastCheck(new Date().toLocaleTimeString("fa-IR"));
      showToast("اتصال به مودم برقرار است.");
    } catch (err) {
      setStatus({ connected: false });
      setLastCheck(new Date().toLocaleTimeString("fa-IR"));
      showToast(err instanceof Error ? err.message : "سرور پشتیبان در دسترس نیست.", true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await apiRequest<{ templates: Template[] }>("/api/templates");
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch { /* silent */ }
      finally { setTplLoading(false); }
    }
    loadTemplates();
  }, []);

  /** استخراج متغیرهای قالب از متن — منطبق با Regex بک‌اند */
  function extractVars(body: string): string[] {
    const out: string[] = [];
    for (const m of body.matchAll(/\{([\wآ-ی]{1,30})\}/g)) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
    return out;
  }

  const createVars = extractVars(tplBody);

  async function handleCreateTemplate() {
    if (!tplTitle.trim() || !tplBody.trim()) {
      showToast("عنوان و متن قالب الزامی است.", true);
      return;
    }
    setTplSaving(true);
    try {
      const res = await apiRequest<{ id?: number }>("/api/templates", { method: "POST", body: JSON.stringify({ title: tplTitle.trim(), body: tplBody.trim() }) });
      showToast("قالب جدید ساخته شد.");
      setTemplates((prev) => [
        { id: res.id ?? Date.now(), title: tplTitle.trim(), body: tplBody.trim(), created_at: "", updated_at: "", variables: extractVars(tplBody) },
        ...prev,
      ]);
      setTplTitle("");
      setTplBody("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در ساخت قالب", true);
    } finally {
      setTplSaving(false);
    }
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditBody(t.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
  }

  async function handleUpdateTemplate() {
    if (editingId === null) return;
    if (!editTitle.trim() || !editBody.trim()) {
      showToast("عنوان و متن قالب الزامی است.", true);
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(`/api/templates/${editingId}`, { method: "PUT", body: JSON.stringify({ title: editTitle.trim(), body: editBody.trim() }) });
      setTemplates((prev) => prev.map((t) =>
        t.id === editingId
          ? { ...t, title: editTitle.trim(), body: editBody.trim(), updated_at: new Date().toISOString(), variables: extractVars(editBody) }
          : t
      ));
      showToast("قالب ویرایش شد.");
      cancelEdit();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در ویرایش قالب", true);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteTemplate(id: number) {
    try {
      await apiRequest(`/api/templates/${id}`, { method: "DELETE" });
      showToast("قالب حذف شد.");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در حذف قالب", true);
    }
  }

  function toggleTplSort(key: "title" | "created_at") {
    setTplSortDir((d) => (tplSortKey === key && d === "asc" ? "desc" : "asc"));
    setTplSortKey(key);
  }

  const sortedTemplates = [...templates].sort((a, b) => {
    const av = tplSortKey === "title" ? a.title : a.created_at;
    const bv = tplSortKey === "title" ? b.title : b.created_at;
    return tplSortDir === "asc" ? String(av).localeCompare(String(bv)) : -String(av).localeCompare(String(bv));
  });

  return (
    <div dir="rtl" className="fade-in-up grid gap-4 lg:grid-cols-2">
      <BentoBox title="اتصال و مودم" icon={Cable}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-4 w-4" /> آدرس IP مودم
            </span>
            <code dir="ltr" className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-700">172.16.33.254</code>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> وضعیت اتصال
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                !status
                  ? "bg-slate-100 text-slate-500"
                  : status.connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
              )}
            >
              {!status ? "در حال بررسی..." : status.connected ? "متصل" : "قطع"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">شبکه</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.network_type ?? "—")}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">سیگنال</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.signal_level ?? 0)}٪</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <p className="text-[10px] text-muted-foreground">سیم‌کارت</p>
              <p className="mt-1 text-sm font-bold">{faDigits(status?.sim_status ?? "—")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              آخرین بررسی: {lastCheck ? faDigits(lastCheck) : "—"}
            </p>
            <Button size="sm" variant="outline" onClick={testConnection} disabled={checking} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
              تست اتصال
            </Button>
          </div>
        </div>
      </BentoBox>

      <BentoBox title="پیکربندی" icon={Settings2}>
        <div className="space-y-2">
          {[
            { label: "رابط کاربری", value: "Vazirmatn · راست‌به‌چپ", dir: "rtl" as const },
            { label: "سرور پشتیبان", value: BASE, dir: "ltr" as const },
            { label: "دوره نمودار", value: "۷ روز اخیر", dir: "rtl" as const },
            { label: "ذخیره مخاطبین", value: "دستگاه شما (localStorage)", dir: "rtl" as const },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <code dir={row.dir} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {row.value}
              </code>
            </div>
          ))}
        </div>
      </BentoBox>

      <BentoBox title="مدیریت قالب‌های آماده" icon={FileText} className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div>
              <Label className="block text-sm font-medium mb-1">عنوان قالب</Label>
              <Input
                value={tplTitle}
                onChange={(e) => setTplTitle(e.target.value)}
                placeholder="مثال: تبریک سال نو"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium mb-1">متن قالب</Label>
              <textarea
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground dark:text-slate-100 dark:border-white/10"
                placeholder="متن پیام... از {نام} و {نام خانوادگی} استفاده کنید"
              />
              {createVars.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">متغیرهای شناسایی‌شده:</span>
                  {createVars.map((v) => (
                    <span key={v} dir="ltr" className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {'{'}{v}{'}'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleCreateTemplate} disabled={tplSaving} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {tplSaving ? "در حال ذخیره..." : "افزودن قالب"}
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-muted-foreground dark:bg-slate-800">
              <span
                className="cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleTplSort("title")}
              >
                عنوان قالب{tplSortKey === "title" ? (tplSortDir === "asc" ? " ↑" : " ↓") : " ↕"}
              </span>
              <span className="text-[10px]">{sortedTemplates.length} قالب</span>
            </div>
            {tplLoading ? (
              <div className="flex gap-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}</div>
            ) : sortedTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">هیچ قالبی وجود ندارد.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {sortedTemplates.map((t) => (
                  <li key={t.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.body}</p>
                        {(t.variables ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(t.variables ?? []).map((v) => (
                              <span key={v} dir="ltr" className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {'{'}{v}{'}'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => (editingId === t.id ? cancelEdit() : startEdit(t))} className="gap-1 text-slate-600 hover:text-slate-800 dark:text-slate-300">
                          <PenLine className="h-3.5 w-3.5" />
                          {editingId === t.id ? "انصراف" : "ویرایش"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(t.id)} className="text-red-600 hover:text-red-700 gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </Button>
                      </div>
                    </div>
                    {editingId === t.id && (
                      <div className="mt-2 space-y-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-slate-800/40">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" placeholder="عنوان قالب" />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground dark:text-slate-100 dark:border-white/10"
                          placeholder="متن قالب"
                        />
                        <div className="flex items-center justify-between">
                          {extractVars(editBody).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {extractVars(editBody).map((v) => (
                                <span key={v} dir="ltr" className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                  {'{'}{v}{'}'}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button size="sm" variant="outline" onClick={cancelEdit} className="gap-1 text-xs">
                              <X className="h-3 w-3" /> لغو
                            </Button>
                            <Button size="sm" onClick={handleUpdateTemplate} disabled={editSaving} className="gap-1 text-xs">
                              {editSaving ? "در حال ذخیره..." : "ذخیره"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </BentoBox>

      <BentoBox title="مستندات API" icon={BookOpen} className="lg:col-span-2">
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/5">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-muted-foreground dark:bg-slate-800/50">
                <th className="px-3 py-2.5 font-medium">متد</th>
                <th className="px-3 py-2.5 font-medium">مسیر</th>
                <th className="px-3 py-2.5 font-medium">توضیح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold",
                        e.method === "GET"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : e.method === "POST"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                      )}
                    >
                      {e.method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <code dir="ltr" className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{e.path}</code>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BentoBox>
    </div>
  );
}