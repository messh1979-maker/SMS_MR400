export type SmsMessage = {
  id: number;
  sender: string;
  content: string;
  received_at: string;
  unread: boolean;
};

export type NumberStat = { number: string; count: number; last_at?: string | null };

export type StatsData = {
  received: { total: number; by_number: NumberStat[] };
  sent: { total: number; by_number: NumberStat[] };
  updated_at: string;
};

export type ActivityPoint = { date: string; received: number; sent: number };

export type SentEntry = { phone: string; message: string; sent_at: string };

export type Contact = {
  number: string;
  received: number;
  sent: number;
  last_at?: string | null;
  last_message?: string | null;
};

export type PageId = "dashboard" | "send" | "inbox" | "history" | "contacts" | "settings";