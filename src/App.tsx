import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ToastHost from "@/components/ToastHost";
import CommandPalette from "@/components/CommandPalette";
import Dashboard from "@/pages/Dashboard";
import SendPage from "@/pages/SendPage";
import InboxPage from "@/pages/InboxPage";
import HistoryPage from "@/pages/HistoryPage";
import ContactsPage from "@/pages/ContactsPage";
import ScheduledPage from "@/pages/ScheduledPage";
import SettingsPage from "@/pages/SettingsPage";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import type { Contact, ContactDetail, PageId, SendPrefill } from "@/lib/types";

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
  const [prefill, setPrefill] = useState<SendPrefill | null>(null);
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

  const handlePickContact = useCallback((c: Contact) => { setPrefill({ mobile: c.number }); setPage("send"); }, []);
  const handleSendTo = useCallback((c: ContactDetail) => { setPrefill({ mobile: c.mobile, first_name: c.first_name, last_name: c.last_name }); setPage("send"); }, []);
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
          {page === "send" && <SendPage key={refreshNonce} prefill={prefill} onConsumePrefill={consumePrefill} onNavigate={navigate} />}
          {page === "inbox" && <InboxPage key={refreshNonce} />}
          {page === "history" && <HistoryPage key={refreshNonce} />}
          {page === "contacts" && <ContactsPage key={refreshNonce} onSendTo={handleSendTo} />}
          {page === "scheduled" && <ScheduledPage key={refreshNonce} />}
          {page === "settings" && <SettingsPage key={refreshNonce} />}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} contacts={contacts} onNavigate={navigate} onPickContact={handlePickContact} />
      <ToastHost />
    </div>
  );
}
