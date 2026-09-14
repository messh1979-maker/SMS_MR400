"""
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
    raise SystemExit("کتابخانهٔ tplinkrouterc6u نصب نیست.\n pip install -r requirements.txt") from exc

# --------------------------------------------------------------- تنظیمات --
ROUTER_HOST = os.environ.get("ROUTER_HOST", "http://172.16.33.254")
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
PHONE_REGEX = re.compile(r"^(09\d{9}|989\d{9})$")

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
