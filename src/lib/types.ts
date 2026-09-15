export type SmsMessage = {
  id: number;
  sender: string;
  content: string;
  received_at: string;
  unread: boolean;
  category?: string;
};

export type NumberStat = { number: string; count: number; last_at?: string | null };

export type StatsData = {
  received: { total: number; by_number: NumberStat[] };
  sent: { total: number; by_number: NumberStat[] };
  updated_at: string;
};

export type ActivityPoint = { date: string; received: number; sent: number };

export type SentEntry = {
  id: number;
  phone: string;
  message: string;
  sent_at: string;
  status: "active" | "archived" | "deleted";
  updated_at?: string | null;
};

export type Contact = {
  number: string;
  received: number;
  sent: number;
  last_at?: string | null;
  last_message?: string | null;
};

export type ContactDetail = {
  id: number;
  first_name: string;
  last_name: string;
  mobile: string;
  landline: string;
  city: string;
  department: string;
  company: string;
  province: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

export type ScheduledSms = {
  id: number;
  mobile: string;
  message: string;
  scheduled_at_utc: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  retries: number;
  max_retries: number;
  created_at: string;
  sent_at?: string | null;
};

export type SmsCounts = { pending: number; failed: number };

export type SendPrefill = {
  mobile: string;
  first_name?: string;
  last_name?: string;
};

export type PageId = "dashboard" | "send" | "inbox" | "history" | "contacts" | "settings" | "scheduled";