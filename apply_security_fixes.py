import os

# ==============================================================================
# محتوای کامل و امن تمام فایل‌های پروژه
# ==============================================================================

FILES_TO_UPDATE = {
    # 1. بک‌اند: هسته اصلی با لایه‌های امنیتی (احراز هویت، اعتبارسنجی، نوشتن اتمی)
    "backend/app.py": '''"""
SMS Gateway Backend -- TP-Link Archer MR400 v4.3 (4G LTE) integration
Security Hardened Version
"""
import json
import logging
import os
import re
import tempfile
from dataclasses import asdict
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv(encoding="utf-8-sig")

try:
    from tplinkrouterc6u import TplinkRouterProvider
except ImportError as exc:
    raise SystemExit("کتابخانهٔ tplinkrouterc6u نصب نیست.\\n pip install -r requirements.txt") from exc

# --------------------------------------------------------------- تنظیمات --
ROUTER_HOST = os.environ.get("ROUTER_HOST", "http://192.168.1.1")
ROUTER_USER = os.environ.get("ROUTER_USER", "admin")
ROUTER_PASSWORD = os.environ.get("ROUTER_PASSWORD")
API_KEY = os.environ.get("API_KEY")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
PORT = int(os.environ.get("PORT", "5000"))

if not ROUTER_PASSWORD:
    raise SystemExit("متغیر محیطی ROUTER_PASSWORD تنظیم نشده است.")
if not API_KEY:
    raise SystemExit("متغیر محیطی API_KEY تنظیم نشده است. لطفاً یک کلید امنیتی تصادفی در فایل .env قرار دهید.")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sms-gateway")

# ----------------------------------------------------------- لاگ پیامک‌ها --
SENT_LOG_FILE = Path(__file__).resolve().parent / "sent_log.json"

def _load_sent_log() -> list:
    if not SENT_LOG_FILE.exists():
        return []
    try:
        return json.loads(SENT_LOG_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

def _append_sent_log(phone: str, message: str) -> None:
    entries = _load_sent_log()
    entries.append({"phone": phone, "message": message, "sent_at": datetime.now().isoformat(timespec="seconds")})
    # نوشتن اتمی (Atomic Write) برای جلوگیری از Corruption فایل در صورت قطع برق یا Race Condition
    try:
        fd, tmp_path = tempfile.mkstemp(dir=SENT_LOG_FILE.parent, suffix=".json")
        with os.fdopen(fd, 'w', encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, SENT_LOG_FILE)
    except OSError as e:
        logger.error("خطا در ذخیره‌سازی اتمی لاگ پیامک: %s", e)

# --------------------------------------------------------------- اپلیکیشن --
app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS)
_lock = Lock()

# -------------------------------------------------------- احراز هویت API --
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        provided_key = request.headers.get("X-API-Key")
        if not provided_key or provided_key != API_KEY:
            logger.warning("تلاش ناموفق برای دسترسی به API با کلید: %s", provided_key)
            return jsonify({"error": "دسترسی غیرمجاز. کلید API نامعتبر است."}), 401
        return f(*args, **kwargs)
    return decorated_function

# ---------------------------------------------------------- مدیریت مودم --
def with_modem(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        with _lock:
            router = TplinkRouterProvider.get_client(ROUTER_HOST, ROUTER_PASSWORD, ROUTER_USER)
            try:
                router.authorize()
            except Exception as exc:
                logger.error("ورود به مودم ناموفق بود: %s", exc)
                return jsonify({"error": "اتصال یا ورود به مودم ناموفق بود"}), 502
            
            try:
                return func(router, *args, **kwargs)
            except Exception as exc:
                logger.exception("خطای داخلی در ارتباط با مودم")
                # عدم افشای جزئیات خطا به کلاینت (Information Disclosure Prevention)
                return jsonify({"error": "خطای داخلی سرور در ارتباط با مودم"}), 502
            finally:
                try:
                    router.logout()
                except Exception:
                    logger.warning("خروج (logout) از نشست مودم ناموفق بود.")
    return wrapper

# ------------------------------------------------------- اعتبارسنجی ورودی --
PHONE_REGEX = re.compile(r"^(09\\d{9}|989\\d{9})$")

def _valid_phone(phone: str) -> bool:
    cleaned = phone.strip().replace("+", "").replace(" ", "")
    return bool(PHONE_REGEX.match(cleaned))

def _sms_to_dict(sms) -> dict:
    data = asdict(sms)
    received_at = data.get("received_at")
    if isinstance(received_at, datetime):
        data["received_at"] = received_at.isoformat()
    return data

# ----------------------------------------------------------------- روت‌ها --
@app.route("/api/status", methods=["GET"])
@require_api_key
@with_modem
def api_status(router):
    lte = router.get_lte_status()
    return jsonify({
        "router_host": ROUTER_HOST, "status": "running", "network_type": lte.network_type_info,
        "sim_status": lte.sim_status_info, "signal_level": lte.sig_level, "unread_sms": lte.sms_unread_count,
    })

@app.route("/api/send_sms", methods=["POST"])
@require_api_key
@with_modem
def api_send_sms(router):
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    message = str(data.get("message", "")).strip()

    if not phone or not message:
        return jsonify({"error": "شماره و متن پیام الزامی است"}), 400
    if not _valid_phone(phone):
        return jsonify({"error": "شماره موبایل وارد شده معتبر نیست (فرمت صحیح: 09xxxxxxxxx)"}), 400
    if len(message) > 5 * 160:
        return jsonify({"error": "متن پیام بیش از حد طولانی است (حداکثر ۵ پیامک)"}), 400

    router.send_sms(phone, message)
    _append_sent_log(phone, message)
    logger.info("پیامک برای %s ارسال شد", phone)
    return jsonify({"success": True})

@app.route("/api/inbox", methods=["GET"])
@require_api_key
@with_modem
def api_inbox(router):
    messages = router.get_sms()
    return jsonify({"messages": [_sms_to_dict(m) for m in messages]})

@app.route("/api/sms", methods=["DELETE"])
@require_api_key
@with_modem
def api_delete_sms(router):
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids or not all(isinstance(i, int) for i in ids):
        return jsonify({"error": "شناسه‌های پیامک معتبر نیستند"}), 400

    messages = router.get_sms()
    ids_set = set(ids)
    deleted = 0
    for sms in messages:
        if sms.id in ids_set:
            router.delete_sms(sms)
            deleted += 1
    logger.info("%d پیامک حذف شد", deleted)
    return jsonify({"success": True, "deleted": deleted})

@app.route("/api/stats", methods=["GET"])
@require_api_key
@with_modem
def api_stats(router):
    messages = router.get_sms()
    received_map = {}
    for sms in messages:
        sender = sms.sender or "ناشناس"
        rec = received_map.setdefault(sender, {"count": 0, "last_at": None})
        rec["count"] += 1
        iso = sms.received_at.isoformat() if sms.received_at else None
        if iso and (rec["last_at"] is None or iso > rec["last_at"]):
            rec["last_at"] = iso

    sent_map = {}
    for entry in _load_sent_log():
        phone = str(entry.get("phone", "ناشناس"))
        s = sent_map.setdefault(phone, {"count": 0, "last_at": None})
        s["count"] += 1
        sent_at = entry.get("sent_at")
        if sent_at and (s["last_at"] is None or sent_at > s["last_at"]):
            s["last_at"] = sent_at

    def top(mapping: dict) -> list:
        return sorted(({"number": number, "count": stat["count"], "last_at": stat["last_at"]} for number, stat in mapping.items()), key=lambda item: item["count"], reverse=True)[:10]

    return jsonify({
        "received": {"total": len(messages), "by_number": top(received_map)},
        "sent": {"total": sum(v["count"] for v in sent_map.values()), "by_number": top(sent_map)},
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    })

@app.route("/api/activity", methods=["GET"])
@require_api_key
@with_modem
def api_activity(router):
    try:
        days = max(1, min(int(request.args.get("days", "7")), 30))
    except (TypeError, ValueError):
        days = 7
    today = datetime.now().date()
    sent_by = {}
    for entry in _load_sent_log():
        try:
            d = datetime.fromisoformat(entry["sent_at"]).date()
            sent_by[d] = sent_by.get(d, 0) + 1
        except (ValueError, KeyError, TypeError):
            continue
    recv_by = {}
    for m in router.get_sms():
        if m.received_at is None: continue
        d = m.received_at.date()
        recv_by[d] = recv_by.get(d, 0) + 1

    series = [{"date": (today - timedelta(days=i)).isoformat(), "received": recv_by.get(today - timedelta(days=i), 0), "sent": sent_by.get(today - timedelta(days=i), 0)} for i in range(days - 1, -1, -1)]
    return jsonify({"days": days, "series": series})

@app.route("/api/contacts", methods=["GET"])
@require_api_key
@with_modem
def api_contacts(router):
    contacts = {}
    for m in router.get_sms():
        sender = m.sender or "ناشناس"
        c = contacts.setdefault(sender, {"number": sender, "received": 0, "sent": 0, "last_at": None, "last_message": None})
        c["received"] += 1
        iso = m.received_at.isoformat() if m.received_at else None
        if iso and (c["last_at"] is None or iso > c["last_at"]):
            c["last_at"] = iso
            c["last_message"] = m.content

    for entry in _load_sent_log():
        phone = str(entry.get("phone", "ناشناس"))
        c = contacts.setdefault(phone, {"number": phone, "received": 0, "sent": 0, "last_at": None, "last_message": None})
        c["sent"] += 1
        sent_at = entry.get("sent_at")
        if sent_at and (c["last_at"] is None or sent_at > c["last_at"]):
            c["last_at"] = sent_at

    result = sorted(contacts.values(), key=lambda c: (c["received"] + c["sent"]), reverse=True)
    return jsonify({"contacts": result[:100]})

@app.route("/api/history", methods=["GET"])
@require_api_key
def api_history():
    entries = _load_sent_log()
    return jsonify({"entries": list(reversed(entries))})

@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "مسیر یافت نشد"}), 404

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=DEBUG)
''',

    # 2. بک‌اند: فایل نمونه محیطی با کلید امنیتی
    "backend/.env.example": '''# این فایل را کپی کنید به .env و مقادیر واقعی را وارد کنید
# .env را هرگز به گیت/گیت‌هاب پوش نکنید

ROUTER_HOST=http://192.168.1.1
ROUTER_USER=admin
ROUTER_PASSWORD=رمز_واقعی_مودم

# کلید امنیتی برای احراز هویت درخواست‌های API (یک رشته تصادفی و طولانی تولید کنید)
# مثال در لینوکس/مک: openssl rand -hex 32
API_KEY=your-super-secret-random-api-key-here

ALLOWED_ORIGINS=http://localhost:5173
FLASK_DEBUG=false
PORT=5000
''',

    # 3. فرانت‌اند: لایه ارتباطی امن
    "src/lib/api.ts": '''const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const API_KEY = import.meta.env.VITE_API_KEY;

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiRequest<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(API_KEY && !options.skipAuth ? { "X-API-Key": API_KEY } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `خطای شبکه: ${res.status}`);
  }

  return data as T;
}
''',

    # 4. فرانت‌اند: App.tsx (نسخه امن)
    "src/App.tsx": '''import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ToastHost from "@/components/ToastHost";
import CommandPalette from "@/components/CommandPalette";
import Dashboard from "@/pages/Dashboard";
import SendPage from "@/pages/SendPage";
import InboxPage from "@/pages/InboxPage";
import HistoryPage from "@/pages/HistoryPage";
import ContactsPage from "@/pages/ContactsPage";
import SettingsPage from "@/pages/SettingsPage";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import type { Contact, PageId } from "@/lib/types";

export default function App() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("sms-theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const [page, setPage] = useState<PageId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sms-theme", dark ? "dark" : "light");
  }, [dark]);

  const refreshStatus = useCallback(async () => {
    try {
      await apiRequest("/api/status");
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const id = window.setInterval(refreshStatus, 30000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = useCallback(async () => {
    setPaletteOpen(true);
    if (contacts.length > 0) return;
    try {
      const data = await apiRequest<{ contacts: Contact[] }>("/api/contacts");
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch { /* بی‌صدا */ }
  }, [contacts.length]);

  const handlePickContact = useCallback((c: Contact) => { setPrefill(c.number); setPage("send"); }, []);
  const handleSendTo = useCallback((c: Contact) => { setPrefill(c.number); setPage("send"); }, []);
  const consumePrefill = useCallback(() => setPrefill(null), []);
  const navigate = useCallback((p: PageId) => setPage(p), []);
  
  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
    refreshStatus();
    showToast("داده‌ها به‌روزرسانی شد.");
  }, [refreshStatus]);

  return (
    <div dir="rtl" className="flex min-h-screen bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(59,130,246,0.10),transparent),radial-gradient(60%_50%_at_90%_110%,rgba(129,140,248,0.08),transparent)]">
      <Sidebar page={page} onNavigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar page={page} dark={dark} onToggleTheme={() => setDark((v) => !v)} onOpenCommand={openPalette} onRefresh={refresh} refreshing={false} connected={connected} />
        <main className="flex-1 p-4 sm:p-6">
          {page === "dashboard" && <Dashboard key={refreshNonce} onNavigate={navigate} />}
          {page === "send" && <SendPage key={refreshNonce} prefillNumber={prefill} onConsumePrefill={consumePrefill} />}
          {page === "inbox" && <InboxPage key={refreshNonce} />}
          {page === "history" && <HistoryPage key={refreshNonce} />}
          {page === "contacts" && <ContactsPage key={refreshNonce} onSendTo={handleSendTo} />}
          {page === "settings" && <SettingsPage key={refreshNonce} />}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} contacts={contacts} onNavigate={navigate} onPickContact={handlePickContact} />
      <ToastHost />
    </div>
  );
}
''',

    # 5. فرانت‌اند: SendPage.tsx (نسخه امن با حفظ UI اصلی)
    "src/pages/SendPage.tsx": '''import { useEffect, useMemo, useState } from "react";
import { Send, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobilePreview from "@/components/MobilePreview";
import { faDigits, countSmsParts } from "@/lib/format";
import { normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";

const VARIABLES = [
  { label: "نام", tag: "{نام}" },
  { label: "نام خانوادگی", tag: "{نام خانوادگی}" },
  { label: "کد ملی", tag: "{کدملی}" },
  { label: "سلام", tag: "{سلام}" },
];

export default function SendPage({ prefillNumber, onConsumePrefill }: { prefillNumber: string | null; onConsumePrefill: () => void }) {
  const [phone, setPhone] = useState(prefillNumber || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (prefillNumber) { setPhone(prefillNumber); onConsumePrefill(); }
  }, [prefillNumber, onConsumePrefill]);

  const cleaned = useMemo(() => normalizeNumber(phone), [phone]);
  const validPhone = useMemo(() => /^09\\d{9}$/.test(cleaned), [cleaned]);
  const parts = useMemo(() => countSmsParts(message), [message]);
  const overLimit = parts > 6;

  async function handleSend() {
    if (!validPhone || !message.trim()) {
      showToast(validPhone ? "متن پیام را بنویسید." : "شماره معتبر وارد کنید.", true);
      return;
    }
    if (overLimit) {
      showToast("طول پیام بیش از حد مجاز (۶ پیامک) است.", true);
      return;
    }

    setSending(true);
    setSent(false);
    try {
      await apiRequest("/api/send_sms", {
        method: "POST",
        body: JSON.stringify({ phone: cleaned, message }),
      });
      setSent(true);
      setMessage("");
      showToast(`پیامک به ${faDigits(cleaned)} ارسال شد.`);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در ارتباط با سرور", true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">ارسال پیامک جدید</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">شماره موبایل</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="مثال: 09123456789" className={`w-full p-2 rounded-md border ${validPhone || !phone ? "border-gray-300" : "border-red-500"}`} />
            {!validPhone && phone && <p className="text-xs text-red-500 mt-1">شماره موبایل معتبر نیست</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">متن پیام</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="w-full p-2 rounded-md border border-gray-300" placeholder="متن پیام خود را اینجا بنویسید..." />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{parts} بخش (پارت)</span>
              <span className={overLimit ? "text-red-500" : ""}>{overLimit ? "محدودیت ۶ بخش" : `${160 * (parts > 0 ? parts : 1) - (parts > 1 ? (parts - 1) * 7 : 0) - message.length} کاراکتر باقی‌مانده`}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button key={v.tag} type="button" onClick={() => setMessage((prev) => prev + v.tag)} className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">{v.label}</button>
            ))}
          </div>
          <Button onClick={handleSend} disabled={sending || !validPhone || !message.trim() || overLimit} className="w-full">
            {sending ? "در حال ارسال..." : sent ? <><CheckCheck className="w-4 h-4 ml-2" /> ارسال شد</> : <><Send className="w-4 h-4 ml-2" /> ارسال پیامک</>}
          </Button>
        </div>
        <div className="lg:sticky lg:top-6">
          <MobilePreview phone={cleaned || "09xxxxxxxxx"} message={message || "پیش‌نمایش پیام شما در اینجا نمایش داده می‌شود..."} />
        </div>
      </div>
    </div>
  );
}
''',

    # 6. فرانت‌اند: InboxPage.tsx (نسخه امن)
    "src/pages/InboxPage.tsx": '''import { useEffect, useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import { getCategory } from "@/lib/sms";

interface SmsMessage { id: number; sender: string; content: string; received_at: string; }

export default function InboxPage() {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ messages: SmsMessage[] }>("/api/inbox");
      setMessages(data.messages || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در دریافت پیامک‌ها", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInbox(); }, []);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`آیا از حذف ${selectedIds.size} پیامک اطمینان دارید؟`)) return;
    try {
      await apiRequest("/api/sms", { method: "DELETE", body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      showToast("پیامک‌های انتخاب‌شده با موفقیت حذف شدند.");
      setSelectedIds(new Set());
      fetchInbox();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در حذف پیامک‌ها", true);
    }
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">صندوق دریافت</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInbox}><RefreshCw className="w-4 h-4 ml-2" /> به‌روزرسانی</Button>
          {selectedIds.size > 0 && <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="w-4 h-4 ml-2" /> حذف ({selectedIds.size})</Button>}
        </div>
      </div>
      <div className="space-y-3">
        {messages.length === 0 ? <p className="text-center text-gray-500 py-8">پیامکی یافت نشد.</p> : messages.map((msg) => {
          const cat = getCategory(msg.sender);
          return (
            <div key={msg.id} className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <input type="checkbox" checked={selectedIds.has(msg.id)} onChange={() => toggleSelect(msg.id)} className="mt-1 w-4 h-4 rounded border-gray-300" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cat.pill}`}>{cat.label}</span>
                  <span className="text-xs text-muted-foreground">{new Date(msg.received_at).toLocaleString("fa-IR")}</span>
                </div>
                <p className="font-semibold mt-1 truncate">{msg.sender}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-1">{msg.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
''',

    # 7. فرانت‌اند: Dashboard.tsx (نسخه امن)
    "src/pages/Dashboard.tsx": '''import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";

interface StatData { received: { total: number; by_number: any[] }; sent: { total: number; by_number: any[] }; }
interface ActivityData { series: { date: string; received: number; sent: number }[]; }

export default function Dashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [stats, setStats] = useState<StatData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, activityRes] = await Promise.all([
        apiRequest<StatData>("/api/stats"),
        apiRequest<ActivityData>("/api/activity?days=7"),
      ]);
      setStats(statsRes);
      setActivity(activityRes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در دریافت آمار", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  if (loading) return <div className="p-8 text-center">در حال بارگذاری داشبورد...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">داشبورد کلی</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl border bg-card">
          <h3 className="text-lg font-semibold mb-2">پیامک‌های دریافتی</h3>
          <p className="text-3xl font-bold text-primary">{stats?.received.total ?? 0}</p>
        </div>
        <div className="p-6 rounded-xl border bg-card">
          <h3 className="text-lg font-semibold mb-2">پیامک‌های ارسالی</h3>
          <p className="text-3xl font-bold text-emerald-600">{stats?.sent.total ?? 0}</p>
        </div>
      </div>
      <div className="p-6 rounded-xl border bg-card">
        <h3 className="text-lg font-semibold mb-4">فعالیت ۷ روز اخیر</h3>
        <div className="space-y-2">
          {activity?.series.map((day) => (
            <div key={day.date} className="flex justify-between text-sm border-b pb-2">
              <span>{day.date}</span>
              <span className="text-muted-foreground">دریافتی: {day.received} | ارسالی: {day.sent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
''',

    # 8. فرانت‌اند: HistoryPage.tsx (نسخه امن)
    "src/pages/HistoryPage.tsx": '''import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";

interface HistoryEntry { phone: string; message: string; sent_at: string; }

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="space-y-3">
        {history.length === 0 ? <p className="text-center text-gray-500 py-8">سابقه‌ای یافت نشد.</p> : history.map((entry, idx) => (
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
''',

    # 9. فرانت‌اند: ContactsPage.tsx (نسخه امن)
    "src/pages/ContactsPage.tsx": '''import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface Contact { number: string; received: number; sent: number; last_at: string | null; last_message: string | null; }

export default function ContactsPage({ onSendTo }: { onSendTo: (c: Contact) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await apiRequest<{ contacts: Contact[] }>("/api/contacts");
        setContacts(data.contacts || []);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "خطا در دریافت مخاطبین", true);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">مخاطبین هوشمند</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((c, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-card flex justify-between items-start">
            <div>
              <p className="font-semibold">{c.number}</p>
              <p className="text-xs text-muted-foreground mt-1">دریافتی: {c.received} | ارسالی: {c.sent}</p>
              {c.last_message && <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic">"{c.last_message}"</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => onSendTo(c)}>
              <MessageSquare className="w-4 h-4 ml-2" /> ارسال
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
'''
}

def apply_fixes():
    print("🔧 در حال اعمال تغییرات امنیتی روی تمام فایل‌های پروژه...")
    for filepath, content in FILES_TO_UPDATE.items():
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✅ با موفقیت به‌روزرسانی شد: {filepath}")
    
    print("\\n🎉 عملیات بازنویسی امنیتی کامل با موفقیت انجام شد!")
    print("⚠️ مرحله نهایی و بسیار مهم:")
    print("1. یک فایل به نام `.env` در ریشه پروژه فرانت‌اند (کنار package.json) بسازید.")
    print("2. مقدار زیر را در آن قرار دهید (کلید باید دقیقاً با backend/.env یکی باشد):")
    print("   VITE_API_BASE_URL=http://localhost:5000")
    print("   VITE_API_KEY=your-super-secret-random-api-key-here")
    print("3. سرویس بک‌اند را ری‌استارت کنید.")

if __name__ == "__main__":
    apply_fixes()