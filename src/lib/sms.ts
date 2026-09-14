export type SmsCategory = {
  id: string;
  label: string;
  avatar: string;
  dot: string;
  pill: string;
};

export const CATEGORIES: SmsCategory[] = [
  {
    id: "hamrah",
    label: "همراه اول",
    avatar: "from-emerald-500 to-teal-600",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  {
    id: "irancel",
    label: "ایرانسل",
    avatar: "from-sky-500 to-blue-600",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
  {
    id: "rightel",
    label: "رایتل",
    avatar: "from-violet-500 to-purple-600",
    dot: "bg-violet-500",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  {
    id: "saman",
    label: "سامانتل",
    avatar: "from-fuchsia-500 to-pink-600",
    dot: "bg-fuchsia-500",
    pill: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
  },
  {
    id: "service",
    label: "بانک/سرویس",
    avatar: "from-amber-500 to-orange-600",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  {
    id: "other",
    label: "سایر",
    avatar: "from-slate-400 to-slate-600",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
];

const MCI_PREFIXES = new Set([
  "0910", "0911", "0912", "0913", "0914", "0915", "0916", "0917", "0918", "0919",
  "0931", "0932", "0935", "0936", "0937", "0938", "0939", "0941",
]);
const IRANCELL_PREFIXES = new Set(["0900", "0901", "0902", "0903", "0904", "0905", "0930", "0933", "0934"]);
const RIGHTEL_PREFIXES = new Set(["0920", "0921", "0922", "0923"]);
const SAMANTEL_PREFIXES = new Set(["0990", "0991", "0992"]);

export function findCategory(id: string): SmsCategory {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

const FA_AR_DIGITS = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩";

export function normalizeNumber(raw: string): string {
  const latin = [...raw].map((c) => {
    const i = FA_AR_DIGITS.indexOf(c);
    return i >= 0 ? String(i % 10) : c;
  }).join("");
  let t = latin.replace(/[^\d]/g, "");
  if (t.startsWith("0098")) t = t.slice(2);
  if (t.startsWith("98")) t = "0" + t.slice(2);
  return t;
}

export function getCategory(raw: string): SmsCategory {
  if (!raw) return findCategory("other");
  const t = normalizeNumber(raw);
  if (t.length >= 4 && t.length <= 9) return findCategory("service");
  if (!t.startsWith("0")) return findCategory("other");
  const prefix = t.slice(0, 4);
  if (MCI_PREFIXES.has(prefix)) return findCategory("hamrah");
  if (IRANCELL_PREFIXES.has(prefix)) return findCategory("irancel");
  if (RIGHTEL_PREFIXES.has(prefix)) return findCategory("rightel");
  if (SAMANTEL_PREFIXES.has(prefix)) return findCategory("saman");
  return findCategory("other");
}