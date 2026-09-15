"""
Secure import/export helpers for the phonebook.

- Magic-number sniffing (xlsx = ZIP PK), zip-bomb guard
- Excel formula-injection sanitization
- Header mapping and CSV parsing (UTF-8 with optional BOM)
"""
import csv
import io
import zipfile

from openpyxl import load_workbook

MAX_IMPORT_BYTES = 2 * 1024 * 1024          # 2MB
MAX_XLSX_UNCOMPRESSED = 50 * 1024 * 1024    # zip-bomb threshold
XLSX_SIG = b"PK\x03\x04"
MAX_CELL = 200

_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

# header (از فایل) -> ستون دیتابیس
HEADER_MAP = {
    "first_name": "first_name", "نام": "first_name",
    "last_name": "last_name", "نام خانوادگی": "last_name",
    "mobile": "mobile", "شماره موبایل": "mobile", "موبایل": "mobile",
    "notes": "notes", "توضیحات": "notes", "یادداشت": "notes",
    "landline": "landline", "تلفن ثابت": "landline",
    "city": "city", "شهر": "city",
    "department": "department", "بخش": "department",
    "company": "company", "شرکت": "company",
    "province": "province", "استان": "province",
}


def sniff_file(data: bytes):
    """Validate by magic number + internal structure, not extension."""
    if data.startswith(XLSX_SIG):
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
            total = sum(i.file_size for i in z.infolist())
            if total > MAX_XLSX_UNCOMPRESSED:
                return None
            return "xlsx" if "xl/workbook.xml" in z.namelist() else None
        except (zipfile.BadZipFile, OSError):
            return None
    return "csv" if _looks_like_csv(data[:4096]) else None


def _looks_like_csv(head: bytes) -> bool:
    try:
        head.decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    for ch in (b",", b";", b"\t", b"\n"):
        if ch in head:
            return True
    return False


def sanitize_cell(value) -> str:
    """Strip control chars, cap length, neutralize Excel formulas."""
    s = str(value or "").strip().replace("\x00", "")
    if s[:1] in _DANGEROUS_PREFIXES:
        s = "'" + s
    return s[:MAX_CELL]


def parse_rows(blob: bytes, kind: str):
    """Yield rows as lists, sanitized, exactly one per list item."""
    if kind == "xlsx":
        ws = load_workbook(io.BytesIO(blob), read_only=True, data_only=True).active
        for row in ws.iter_rows(values_only=True):
            yield [sanitize_cell(c) for c in row]
    else:
        text = blob.decode("utf-8-sig", errors="replace")
        yield from ([sanitize_cell(c) for c in row] for row in csv.reader(io.StringIO(text)))