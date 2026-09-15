"""
Inbox message classifier -- lightweight keyword/regex pattern matching (no NLP).

Keeps category logic isolated (SOLID) so app.py stays lean.
"""
import re

_AR_TRANS = str.maketrans("ي\u200cك", "ی ک")

INBOX_CATEGORIES = [
    {"id": "electricity", "name": "قبض برق", "labels": ("برق", "توانیر", "اشتراک برق", "شرکت برق")},
    {"id": "water", "name": "آب و فاضلاب", "labels": ("آب و فاضلاب", "آبفا", "ابفا", "قبض آب", "شرکت آب")},
    {"id": "gas", "name": "گاز", "labels": ("گاز", "گازرسانی", "قبض گاز")},
    {"id": "internet", "name": "اینترنت/دیتا", "labels": ("اینترنت", "دیتا", "مگفا", "پهنای باند", "وای‌فای")},
    {"id": "telecom", "name": "مخابرات", "labels": ("مخابرات", "خدمات ارتباطی", "مشارکت دایره")},
    {"id": "bank", "name": "بانک", "labels": ("بانک", "کارت اعتباری", "کارت بانکی", "موجودی", "واریز", "برداشت", "تراکنش", "حساب", "چک")},
    {"id": "operator", "name": "اپراتور", "labels": ("همراه اول", "ایرانسل", "رایتل", "سامانتل", "خط شما")},
    {"id": "other", "name": "سایر", "labels": ()},
]

DEFAULT_CATEGORY = "other"


def _normalize(text: str) -> str:
    t = re.sub(r"[\W_]+", " ", (text or "").translate(_AR_TRANS).strip().lower())
    return re.sub(r"\s+", " ", t).strip()


def classify_message(content: str) -> str:
    """Return a category id for the given SMS content."""
    t = _normalize(content)
    if not t:
        return DEFAULT_CATEGORY
    for cat in INBOX_CATEGORIES[:-1]:
        if any(kw in t for kw in cat["labels"]):
            return cat["id"]
    return DEFAULT_CATEGORY