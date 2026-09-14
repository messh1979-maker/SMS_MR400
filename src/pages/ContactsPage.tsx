import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface Contact { number: string; received: number; sent: number; last_at: string | null; last_message: string | null; }

export default function ContactsPage({ onSendTo }: { onSendTo: (c: Contact) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await apiRequest<{ contacts: Contact[] }>("/api/contacts");
        setContacts(data.contacts || []);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "خطا در دریافت مخاطبین", true);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">مخاطبین هوشمند</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((c, idx) => (
          <div key={idx} className="p-4 rounded-lg border bg-card flex justify-between items-start">
            <div>
              <p className="font-semibold">{c.number}</p>
              <p className="text-xs text-muted-foreground mt-1">دریافتی: {c.received} | ارسالی: {c.sent}</p>
              {c.last_message && <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic">"{c.last_message}"</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => onSendTo(c)}>
              <MessageSquare className="w-4 h-4 ml-2" /> ارسال
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
