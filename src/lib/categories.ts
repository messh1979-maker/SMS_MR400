import { Zap, Droplets, Flame, Wifi, PhoneCall, Landmark, Signal, Inbox } from "lucide-react";

export type CategoryId =
  | "electricity"
  | "water"
  | "gas"
  | "internet"
  | "telecom"
  | "bank"
  | "operator"
  | "other";

export type CategoryMeta = {
  label: string;
  icon: typeof Zap;
  dot: string;
  avatar: string;
  pill: string;
  iconColor: string;
};

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  electricity: {
    label: "قبض برق",
    icon: Zap,
    dot: "bg-amber-500",
    avatar: "from-amber-500 to-orange-600",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    iconColor: "text-amber-600 dark:text-amber-300",
  },
  water: {
    label: "آب و فاضلاب",
    icon: Droplets,
    dot: "bg-sky-500",
    avatar: "from-sky-500 to-blue-600",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    iconColor: "text-sky-600 dark:text-sky-300",
  },
  gas: {
    label: "گاز",
    icon: Flame,
    dot: "bg-orange-500",
    avatar: "from-orange-500 to-red-600",
    pill: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    iconColor: "text-orange-600 dark:text-orange-300",
  },
  internet: {
    label: "اینترنت/دیتا",
    icon: Wifi,
    dot: "bg-indigo-500",
    avatar: "from-indigo-500 to-violet-600",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
    iconColor: "text-indigo-600 dark:text-indigo-300",
  },
  telecom: {
    label: "مخابرات",
    icon: PhoneCall,
    dot: "bg-emerald-500",
    avatar: "from-emerald-500 to-teal-600",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    iconColor: "text-emerald-600 dark:text-emerald-300",
  },
  bank: {
    label: "بانک",
    icon: Landmark,
    dot: "bg-rose-500",
    avatar: "from-rose-500 to-pink-600",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    iconColor: "text-rose-600 dark:text-rose-300",
  },
  operator: {
    label: "اپراتور",
    icon: Signal,
    dot: "bg-slate-400",
    avatar: "from-slate-500 to-slate-700",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    iconColor: "text-slate-600 dark:text-slate-300",
  },
  other: {
    label: "سایر",
    icon: Inbox,
    dot: "bg-slate-400",
    avatar: "from-slate-400 to-slate-600",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    iconColor: "text-slate-500 dark:text-slate-400",
  },
};

export function getCategoryMeta(id: string): CategoryMeta {
  return CATEGORY_META[(id as CategoryId) in CATEGORY_META ? (id as CategoryId) : "other"];
}