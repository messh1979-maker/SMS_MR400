"""
SMS Gateway Backend -- TP-Link Archer MR400 v4.3 (4G LTE) integration
Security Hardened Version with SQLite, APScheduler, Advanced Phonebook, Templates, Scheduled SMS
"""
import json
import logging
import os
import re
import sqlite3
import tempfile
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from threading import Lock

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

import jdatetime

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

# ----------------------------------------------------------- SQLite DB --
DB_PATH = Path(__file__).resolve().parent / "data.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS contacts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name  TEXT    NOT NULL DEFAULT '',
        last_name   TEXT    NOT NULL DEFAULT '',
        mobile      TEXT    NOT NULL DEFAULT '',
        landline    TEXT    NOT NULL DEFAULT '',
        city        TEXT    NOT NULL DEFAULT '',
        department  TEXT    NOT NULL DEFAULT '',
        company     TEXT    NOT NULL DEFAULT '',
        province    TEXT    NOT NULL DEFAULT '',
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts(mobile);

    CREATE TABLE IF NOT EXISTS templates (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT    NOT NULL DEFAULT '',
        body       TEXT    NOT NULL DEFAULT '',
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheduled_sms (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile            TEXT    NOT NULL,
        message           TEXT    NOT NULL,
        scheduled_at_utc  TEXT    NOT NULL,
        status            TEXT    NOT NULL DEFAULT 'pending',
        retries           INTEGER NOT NULL DEFAULT 0,
        max_retries       INTEGER NOT NULL DEFAULT 3,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        sent_at           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_sms(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_retries ON scheduled_sms(retries);
    """)
    conn.close()

init_db()

# --------------------------------------------------------------- لاگ پیامک‌ها --
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

# ----------------------------------------------------------- APScheduler --
scheduler = BackgroundScheduler(timezone="UTC")
scheduler.start()

def send_scheduled_job(job_id: int, mobile: str, message: str, max_retries: int = 3):
    """Background job to send a scheduled SMS with retry logic."""
    try:
        from tplinkrouterc6u import TplinkRouterProvider
        router = TplinkRouterProvider.get_client(ROUTER_HOST, ROUTER_PASSWORD, ROUTER_USER)
        router.authorize()
        try:
            router.send_sms(mobile, message)
            conn = get_db()
            conn.execute("UPDATE scheduled_sms SET status='sent', sent_at=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), job_id))
            conn.commit()
            conn.close()
            _append_sent_log(mobile, message)
            logger.info("زمان‌بندی %d برای %s ارسال شد", job_id, mobile)
        finally:
            router.logout()
    except Exception as e:
        logger.exception("خطا در ارسال زمان‌بندی %d: %s", job_id, e)
        conn = get_db()
        row = conn.execute("SELECT retries, max_retries FROM scheduled_sms WHERE id=?", (job_id,)).fetchone()
        if row and row["retries"] < row["max_retries"]:
            new_retries = row["retries"] + 1
            run_date = datetime.now(timezone.utc) + timedelta(seconds=30 * new_retries)
            conn.execute("UPDATE scheduled_sms SET retries=?, status='pending', scheduled_at_utc=? WHERE id=?", (new_retries, run_date.isoformat(), job_id))
            conn.commit()
            conn.close()
            scheduler.add_job(
                send_scheduled_job,
                DateTrigger(run_date=run_date),
                args=[job_id, mobile, message, max_retries],
                id=f"scheduled_{job_id}",
                replace_existing=True
            )
            logger.info("زمان‌بندی %d دوباره برنامه‌ریزی شد (تلاش %d/%d)", job_id, new_retries, max_retries)
        else:
            conn.execute("UPDATE scheduled_sms SET status='failed' WHERE id=?", (job_id,))
            conn.commit()
            conn.close()
            logger.error("زمان‌بندی %d بعد از %d تلاش ناموفق بود", job_id, row["retries"] if row else 0)

def load_pending_scheduled():
    """Load pending scheduled SMS jobs on startup."""
    conn = get_db()
    rows = conn.execute("SELECT id, mobile, message, scheduled_at_utc, max_retries FROM scheduled_sms WHERE status='pending'").fetchall()
    conn.close()
    for row in rows:
        try:
            run_date = datetime.fromisoformat(row["scheduled_at_utc"])
            if run_date > datetime.now(timezone.utc):
                scheduler.add_job(
                    send_scheduled_job,
                    DateTrigger(run_date=run_date),
                    args=[row["id"], row["mobile"], row["message"], row["max_retries"]],
                    id=f"scheduled_{row['id']}",
                    replace_existing=True
                )
                logger.info("زمان‌بندی %d برای %s بازیابی شد", row["id"], run_date.isoformat())
        except Exception as e:
            logger.error("خطا در بازیابی زمان‌بندی %d: %s", row["id"], e)

load_pending_scheduled()

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

# --------------------------------------------------------- توابع کمکی شمسی --
def jalali_to_utc(jalali_str: str) -> str:
    """
    Convert Persian date string (e.g., '1403/07/15 14:30') to UTC ISO string.
    Assumes Iran timezone (UTC+3:30).
    """
    try:
        parts = jalali_str.strip().split()
        date_part = parts[0]
        time_part = parts[1] if len(parts) > 1 else "00:00"
        year, month, day = map(int, date_part.split("/"))
        hour, minute = map(int, time_part.split(":"))
        jalali_dt = jdatetime.datetime(year, month, day, hour, minute)
        gregorian_dt = jalali_dt.togregorian()
        # Iran is UTC+3:30
        utc_dt = gregorian_dt - timedelta(hours=3, minutes=30)
        return utc_dt.replace(tzinfo=timezone.utc).isoformat()
    except Exception as e:
        logger.error("خطا در تبدیل تاریخ شمسی: %s", e)
        raise ValueError("فرمت تاریخ نامعتبر است. نمونه: 1403/07/15 14:30")

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

# ---------------------------- CONTACTS CRUD ----------------------------
@app.route("/api/contacts", methods=["GET"])
@require_api_key
def api_contacts_list():
    """List all contacts from SQLite phonebook."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM contacts ORDER BY last_name, first_name").fetchall()
    conn.close()
    contacts = [dict(row) for row in rows]
    return jsonify({"contacts": contacts})

@app.route("/api/contacts", methods=["POST"])
@require_api_key
def api_contacts_create():
    """Create a new contact."""
    data = request.get_json(silent=True) or {}
    required = ["first_name", "last_name", "mobile"]
    if not all(data.get(f) for f in required):
        return jsonify({"error": "فیلدهای نام، نام خانوادگی و موبایل الزامی هستند"}), 400
    if not _valid_phone(data["mobile"]):
        return jsonify({"error": "شماره موبایل معتبر نیست"}), 400

    conn = get_db()
    cur = conn.execute("""
        INSERT INTO contacts (first_name, last_name, mobile, landline, city, department, company, province)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("first_name", "").strip(),
        data.get("last_name", "").strip(),
        data.get("mobile", "").strip(),
        data.get("landline", "").strip(),
        data.get("city", "").strip(),
        data.get("department", "").strip(),
        data.get("company", "").strip(),
        data.get("province", "").strip(),
    ))
    conn.commit()
    contact_id = cur.lastrowid
    conn.close()
    logger.info("مخاطب %d ایجاد شد", contact_id)
    return jsonify({"success": True, "id": contact_id}), 201

@app.route("/api/contacts/<int:contact_id>", methods=["PUT"])
@require_api_key
def api_contacts_update(contact_id: int):
    """Update an existing contact."""
    data = request.get_json(silent=True) or {}
    if not any(data.get(f) for f in ["first_name", "last_name", "mobile", "landline", "city", "department", "company", "province"]):
        return jsonify({"error": "هیچ فیلدی برای به‌روزرسانی ارسال نشده"}), 400

    if "mobile" in data and not _valid_phone(data["mobile"]):
        return jsonify({"error": "شماره موبایل معتبر نیست"}), 400

    conn = get_db()
    cur = conn.execute("SELECT * FROM contacts WHERE id=?", (contact_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "مخاطب یافت نشد"}), 404

    conn.execute("""
        UPDATE contacts SET
            first_name=COALESCE(?, first_name),
            last_name=COALESCE(?, last_name),
            mobile=COALESCE(?, mobile),
            landline=COALESCE(?, landline),
            city=COALESCE(?, city),
            department=COALESCE(?, department),
            company=COALESCE(?, company),
            province=COALESCE(?, province),
            updated_at=datetime('now')
        WHERE id=?
    """, (
        data.get("first_name"),
        data.get("last_name"),
        data.get("mobile"),
        data.get("landline"),
        data.get("city"),
        data.get("department"),
        data.get("company"),
        data.get("province"),
        contact_id
    ))
    conn.commit()
    conn.close()
    logger.info("مخاطب %d به‌روزرسانی شد", contact_id)
    return jsonify({"success": True})

@app.route("/api/contacts/<int:contact_id>", methods=["DELETE"])
@require_api_key
def api_contacts_delete(contact_id: int):
    """Delete a contact."""
    conn = get_db()
    cur = conn.execute("DELETE FROM contacts WHERE id=?", (contact_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    if deleted == 0:
        return jsonify({"error": "مخاطب یافت نشد"}), 404
    logger.info("مخاطب %d حذف شد", contact_id)
    return jsonify({"success": True, "deleted": deleted})

# ---------------------------- TEMPLATES CRUD ----------------------------
@app.route("/api/templates", methods=["GET"])
@require_api_key
def api_templates_list():
    """List all message templates."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM templates ORDER BY title").fetchall()
    conn.close()
    return jsonify({"templates": [dict(row) for row in rows]})

@app.route("/api/templates", methods=["POST"])
@require_api_key
def api_templates_create():
    """Create a new template."""
    data = request.get_json(silent=True) or {}
    if not data.get("title") or not data.get("body"):
        return jsonify({"error": "عنوان و متن قالب الزامی است"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO templates (title, body) VALUES (?, ?)",
        (data["title"].strip(), data["body"].strip())
    )
    conn.commit()
    template_id = cur.lastrowid
    conn.close()
    logger.info("قالب %d ایجاد شد", template_id)
    return jsonify({"success": True, "id": template_id}), 201

@app.route("/api/templates/<int:template_id>", methods=["DELETE"])
@require_api_key
def api_templates_delete(template_id: int):
    """Delete a template."""
    conn = get_db()
    cur = conn.execute("DELETE FROM templates WHERE id=?", (template_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    if deleted == 0:
        return jsonify({"error": "قالب یافت نشد"}), 404
    logger.info("قالب %d حذف شد", template_id)
    return jsonify({"success": True, "deleted": deleted})

# ---------------------------- SCHEDULED SMS ----------------------------
@app.route("/api/send_scheduled", methods=["POST"])
@require_api_key
def api_send_scheduled():
    """Schedule an SMS for future delivery (Persian calendar input)."""
    data = request.get_json(silent=True) or {}
    mobile = str(data.get("mobile", "")).strip()
    message = str(data.get("message", "")).strip()
    scheduled_at = str(data.get("scheduled_at", "")).strip()
    max_retries = int(data.get("max_retries", 3))

    if not mobile or not message or not scheduled_at:
        return jsonify({"error": "شماره، متن و زمان ارسال الزامی است"}), 400
    if not _valid_phone(mobile):
        return jsonify({"error": "شماره موبایل معتبر نیست"}), 400
    if len(message) > 5 * 160:
        return jsonify({"error": "متن پیام بیش از حد طولانی است"}), 400
    if max_retries < 1 or max_retries > 10:
        return jsonify({"error": "تعداد تلاش باید بین ۱ و ۱۰ باشد"}), 400

    try:
        scheduled_at_utc = jalali_to_utc(scheduled_at)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    run_date = datetime.fromisoformat(scheduled_at_utc)
    if run_date <= datetime.now(timezone.utc):
        return jsonify({"error": "زمان انتخابی باید در آینده باشد"}), 400

    conn = get_db()
    cur = conn.execute("""
        INSERT INTO scheduled_sms (mobile, message, scheduled_at_utc, status, max_retries, retries)
        VALUES (?, ?, ?, 'pending', ?, 0)
    """, (mobile, message, scheduled_at_utc, max_retries))
    conn.commit()
    job_id = cur.lastrowid
    conn.close()

    scheduler.add_job(
        send_scheduled_job,
        DateTrigger(run_date=run_date),
        args=[job_id, mobile, message, max_retries],
        id=f"scheduled_{job_id}",
        replace_existing=True
    )
    logger.info("زمان‌بندی %d برای %s در %s ثبت شد", job_id, mobile, scheduled_at_utc)
    return jsonify({"success": True, "id": job_id, "scheduled_at_utc": scheduled_at_utc})

@app.route("/api/scheduled", methods=["GET"])
@require_api_key
def api_scheduled_list():
    """List scheduled SMS jobs."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM scheduled_sms ORDER BY scheduled_at_utc").fetchall()
    conn.close()
    return jsonify({"scheduled": [dict(row) for row in rows]})

@app.route("/api/scheduled/<int:job_id>", methods=["DELETE"])
@require_api_key
def api_scheduled_delete(job_id: int):
    """Cancel a scheduled SMS."""
    conn = get_db()
    row = conn.execute("SELECT status FROM scheduled_sms WHERE id=?", (job_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "زمان‌بندی یافت نشد"}), 404
    if row["status"] != "pending":
        conn.close()
        return jsonify({"error": "فقط زمان‌بندی‌های در انتظار قابل لغو هستند"}), 400

    try:
        scheduler.remove_job(f"scheduled_{job_id}")
    except Exception:
        pass
    conn.execute("UPDATE scheduled_sms SET status='cancelled' WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
    logger.info("زمان‌بندی %d لغو شد", job_id)
    return jsonify({"success": True, "deleted": True})

# ---------------------------- SMS COUNTS ----------------------------
@app.route("/api/sms_counts", methods=["GET"])
@require_api_key
def api_sms_counts():
    """Return counts of pending and failed scheduled SMS."""
    conn = get_db()
    pending = conn.execute("SELECT COUNT(*) FROM scheduled_sms WHERE status='pending'").fetchone()[0]
    failed = conn.execute("SELECT COUNT(*) FROM scheduled_sms WHERE status='failed'").fetchone()[0]
    conn.close()
    return jsonify({"pending": pending, "failed": failed})

# ---------------------------- HISTORY (no modem needed) ----------------------------
@app.route("/api/history", methods=["GET"])
@require_api_key
def api_history():
    entries = _load_sent_log()
    return jsonify({"entries": list(reversed(entries))})

@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "مسیر یافت نشد"}), 404

if __name__ == "__main__":
    try:
        app.run(host="127.0.0.1", port=PORT, debug=DEBUG)
    finally:
        scheduler.shutdown()