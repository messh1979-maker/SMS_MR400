"""
SMS Gateway Backend -- TP-Link Archer MR400 v4.3 (4G LTE) integration
========================================================================

نکتهٔ مهم دربارهٔ معماری
------------------------
کد اصلی فرض کرده بود مودم یک رابط LuCI (مخصوص OpenWrt) روی
"/cgi-bin/luci/..." دارد و از طریق "TR-069" کنترل می‌شود. هیچ‌کدام از
این دو فرض درست نیست:

  1) Archer MR400 از فریمور اختصاصی TP-Link استفاده می‌کند، نه
     OpenWrt/LuCI. مسیرهای cgi-bin/luci اصلاً روی این مودم وجود ندارند.
  2) TR-069 (پروتکل CWMP) برای مدیریت *از راه دور توسط اپراتور/ISP* از
     طریق یک سرور ACS است، نه چیزی که بک‌اند شما مستقیماً و محلی صدا
     بزند. TP-Link هم رسماً اعلام کرده این خانواده از روترها API یا
     دستور رسمی برای SMS ندارند.

راه واقعی، صحبت مستقیم با API داخلیِ پنل وب مودم است (همان چیزی که
مرورگر شما هنگام ورود به رابط مدیریتی مودم صدا می‌زند).

نسخهٔ فعلی این فایل از کتابخانهٔ متن‌باز و فعالانه نگه‌داری‌شدهٔ
`tplinkrouterc6u` استفاده می‌کند که به‌صراحت مدل و فریمور شما یعنی
"Archer MR400 V.4.3" را در فهرست روترهای پشتیبانی‌شده‌اش دارد و توابع
send_sms / get_sms / get_lte_status آماده ارائه می‌دهد:
https://pypi.org/project/tplinkrouterc6u/

نصب:
    pip install -r requirements.txt

هشدار: این هم‌چنان یک API غیررسمی (reverse-engineered) پنل وب مودم است،
نه TR-069 واقعی. با آپدیت فریمور ممکن است رفتار عوض شود؛ نگهدارندهٔ
کتابخانه معمولاً وصله‌های سریع منتشر می‌کند (به CHANGELOG پروژه نگاه
کنید) اما نسخهٔ pip را به‌روز نگه دارید.
"""

import json
import logging
import os
from dataclasses import asdict
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv(encoding="utf-8-sig")  # utf-8-sig یک BOM احتمالی ابتدای فایل را هم نادیده می‌گیرد

try:
    from tplinkrouterc6u import TplinkRouterProvider
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "کتابخانهٔ tplinkrouterc6u نصب نیست.\n"
        "دستور زیر را اجرا کنید:\n"
        "  pip install -r requirements.txt\n"
    ) from exc

# --------------------------------------------------------------- تنظیمات --
# توجه: ROUTER_HOST باید شامل schema باشد، مثلاً http://192.168.1.1
ROUTER_HOST = os.environ.get("ROUTER_HOST", "http://172.16.33.254")
ROUTER_USER = os.environ.get("ROUTER_USER", "admin")
ROUTER_PASSWORD = os.environ.get("ROUTER_PASSWORD")
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]
DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
PORT = int(os.environ.get("PORT", "5000"))

if not ROUTER_PASSWORD:
    raise SystemExit(
        "متغیر محیطی ROUTER_PASSWORD تنظیم نشده است.\n"
        "فایل backend/.env.example را کپی کرده و به‌عنوان .env تکمیل کنید."
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("sms-gateway")

# ------------------------------------------- لاگ پیامک‌های ارسالی (محلی) --
# برای بلاک آماری «بر حسب شماره»؛ پیامک‌های ارسالی روی خود مودم قابل خواندن
# نیستند، پس هر ارسال موفق را به‌صورت محلی ذخیره می‌کنیم.
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
    entries.append(
        {
            "phone": phone,
            "message": message,
            "sent_at": datetime.now().isoformat(timespec="seconds"),
        }
    )
    try:
        SENT_LOG_FILE.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        logger.warning("ذخیرهٔ لاگ پیامک‌های ارسالی ناموفق بود")

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS)

# --------------------------------------------------------- کلاینت مودم --
# طبق مستندات کتابخانه، پنل وب مودم فقط یک نشستِ واردشده را همزمان
# می‌پذیرد. بنابراین برای هر عملیات یک نشست کوتاه‌عمر باز می‌کنیم:
# authorize() -> عملیات -> logout()، و کل این چرخه را با قفل سراسری
# جدی می‌گیریم تا دو درخواست همزمان با هم تداخل نکنند.
_lock = Lock()


def with_modem(func):
    """یک نشست تازه روی مودم باز می‌کند، تابع را صدا می‌زند، و همیشه logout می‌کند."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        with _lock:
            router = TplinkRouterProvider.get_client(ROUTER_HOST, ROUTER_PASSWORD, ROUTER_USER)
            try:
                router.authorize()
            except Exception as exc:  # noqa: BLE001
                logger.error("ورود به مودم ناموفق بود: %s", exc)
                return jsonify({"error": "اتصال یا ورود به مودم ناموفق بود", "detail": str(exc)}), 502

            try:
                return func(router, *args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                logger.exception("خطا در ارتباط با مودم")
                return jsonify({"error": "خطای داخلی مودم", "detail": str(exc)}), 502
            finally:
                try:
                    router.logout()
                except Exception:  # noqa: BLE001
                    logger.warning("خروج (logout) از نشست مودم ناموفق بود؛ نشست بعدی ممکن است رد شود")

    return wrapper


def _valid_phone(phone: str) -> bool:
    digits = phone.strip().replace("+", "").replace(" ", "")
    return digits.isdigit() and 8 <= len(digits) <= 15


def _sms_to_dict(sms) -> dict:
    data = asdict(sms)
    received_at = data.get("received_at")
    if isinstance(received_at, datetime):
        data["received_at"] = received_at.isoformat()
    return data


# ----------------------------------------------------------------- روت‌ها --
@app.route("/api/status", methods=["GET"])
@with_modem
def api_status(router):
    lte = router.get_lte_status()
    return jsonify(
        {
            "router_host": ROUTER_HOST,
            "status": "running",
            "network_type": lte.network_type_info,
            "sim_status": lte.sim_status_info,
            "signal_level": lte.sig_level,
            "unread_sms": lte.sms_unread_count,
        }
    )


@app.route("/api/send_sms", methods=["POST"])
@with_modem
def api_send_sms(router):
    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    message = str(data.get("message", "")).strip()

    if not phone or not message:
        return jsonify({"error": "شماره و متن پیام الزامی است"}), 400
    if not _valid_phone(phone):
        return jsonify({"error": "شمارهٔ موبایل معتبر نیست"}), 400
    if len(message) > 5 * 160:
        return jsonify({"error": "متن پیام بیش از حد طولانی است (حداکثر ۵ پیامک)"}), 400

    router.send_sms(phone, message)
    _append_sent_log(phone, message)
    logger.info("پیامک برای %s ارسال شد", phone)
    return jsonify({"success": True})


@app.route("/api/inbox", methods=["GET"])
@with_modem
def api_inbox(router):
    messages = router.get_sms()
    return jsonify({"messages": [_sms_to_dict(m) for m in messages]})


@app.route("/api/sms", methods=["DELETE"])
@with_modem
def api_delete_sms(router):
    """حذف گروهی پیامک‌ها؛ بدنه باید شامل `{"ids": [1, 2, ...]}` باشد."""
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids or not all(isinstance(i, int) for i in ids):
        return jsonify({"error": "شناسه‌های پیامک معتبر نیست"}), 400

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
@with_modem
def api_stats(router):
    """آمار وارده/ارسال‌شده بر حسب شماره، برای بلاک آماری نمای کلی."""
    messages = router.get_sms()

    received_map: dict[str, dict] = {}
    for sms in messages:
        sender = sms.sender or "ناشناس"
        rec = received_map.setdefault(sender, {"count": 0, "last_at": None})
        rec["count"] += 1
        iso = sms.received_at.isoformat() if sms.received_at else None
        if iso and (rec["last_at"] is None or iso > rec["last_at"]):
            rec["last_at"] = iso

    sent_map: dict[str, dict] = {}
    for entry in _load_sent_log():
        phone = str(entry.get("phone", "ناشناس"))
        s = sent_map.setdefault(phone, {"count": 0, "last_at": None})
        s["count"] += 1
        sent_at = entry.get("sent_at")
        if sent_at and (s["last_at"] is None or sent_at > s["last_at"]):
            s["last_at"] = sent_at

    def top(mapping: dict) -> list:
        return sorted(
            (
                {"number": number, "count": stat["count"], "last_at": stat["last_at"]}
                for number, stat in mapping.items()
            ),
            key=lambda item: item["count"],
            reverse=True,
        )[:10]

    return jsonify(
        {
            "received": {"total": len(messages), "by_number": top(received_map)},
            "sent": {
                "total": sum(v["count"] for v in sent_map.values()),
                "by_number": top(sent_map),
            },
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
    )


@app.route("/api/activity", methods=["GET"])
@with_modem
def api_activity(router):
    """سری زمانی روزانه (وارده/ارسال‌شده) برای نمودار ناحیه‌ای داشبورد."""
    try:
        days = max(1, min(int(request.args.get("days", "7")), 30))
    except (TypeError, ValueError):
        days = 7

    today = datetime.now().date()

    sent_by: dict = {}
    for entry in _load_sent_log():
        try:
            d = datetime.fromisoformat(entry["sent_at"]).date()
        except (ValueError, KeyError, TypeError):
            continue
        sent_by[d] = sent_by.get(d, 0) + 1

    recv_by: dict = {}
    for m in router.get_sms():
        if m.received_at is None:
            continue
        d = m.received_at.date()
        recv_by[d] = recv_by.get(d, 0) + 1

    series = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        series.append(
            {
                "date": d.isoformat(),
                "received": recv_by.get(d, 0),
                "sent": sent_by.get(d, 0),
            }
        )

    return jsonify({"days": days, "series": series})


@app.route("/api/contacts", methods=["GET"])
@with_modem
def api_contacts(router):
    """مخاطبین استخراج‌شده از صندوق وارده + پیامک‌های ارسال‌شده (بر حسب شماره)."""
    contacts: dict = {}

    for m in router.get_sms():
        sender = m.sender or "ناشناس"
        c = contacts.setdefault(
            sender, {"number": sender, "received": 0, "sent": 0, "last_at": None, "last_message": None}
        )
        c["received"] += 1
        iso = m.received_at.isoformat() if m.received_at else None
        if iso and (c["last_at"] is None or iso > c["last_at"]):
            c["last_at"] = iso
            c["last_message"] = m.content

    for entry in _load_sent_log():
        phone = str(entry.get("phone", "ناشناس"))
        c = contacts.setdefault(
            phone, {"number": phone, "received": 0, "sent": 0, "last_at": None, "last_message": None}
        )
        c["sent"] += 1
        sent_at = entry.get("sent_at")
        if sent_at and (c["last_at"] is None or sent_at > c["last_at"]):
            c["last_at"] = sent_at

    result = sorted(
        contacts.values(),
        key=lambda c: (c["received"] + c["sent"]),
        reverse=True,
    )
    return jsonify({"contacts": result[:100]})


@app.route("/api/history", methods=["GET"])
def api_history():
    """تاریخچهٔ پیامک‌های ارسال‌شده (از لاگ محلی)، جدیدترین اول."""
    entries = _load_sent_log()
    return jsonify({"entries": list(reversed(entries))})


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "مسیر یافت نشد"}), 404


if __name__ == "__main__":
    # برای اجرای پایدار (پروداکشن) از gunicorn استفاده کنید، نه این حالت debug:
    #   gunicorn -w 1 -b 0.0.0.0:5000 app:app
    # توجه: حتماً -w 1 (یک worker) چون قفل سراسری فقط در یک پروسه معنا دارد
    # و مودم هم فقط یک نشست همزمان را می‌پذیرد.
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
