import { useEffect, useState } from "react";
import {
  Plus, Search, Edit, Trash2, Phone, MapPin, Building2, User, Loader2
} from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { faDigits } from "@/lib/format";
import { normalizeNumber } from "@/lib/sms";
import { showToast } from "@/lib/toast";
import type { ContactDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY_CONTACT: ContactDetail = {
  id: 0,
  first_name: "",
  last_name: "",
  mobile: "",
  landline: "",
  city: "",
  department: "",
  company: "",
  province: "",
  created_at: "",
  updated_at: "",
};

export default function ContactsPage({ onSendTo }: { onSendTo?: (c: ContactDetail) => void }) {
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactDetail>(EMPTY_CONTACT);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ContactDetail, string>>>({});

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await apiRequest<{ contacts: ContactDetail[] }>("/api/contacts");
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در دریافت مخاطبین", true);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingContact(null);
    setFormData(EMPTY_CONTACT);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(c: ContactDetail) {
    setEditingContact(c);
    setFormData(c);
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingContact(null);
    setFormData(EMPTY_CONTACT);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof ContactDetail, string>> = {};
    if (!formData.first_name.trim()) errors.first_name = "نام الزامی است";
    if (!formData.last_name.trim()) errors.last_name = "نام خانوادگی الزامی است";
    if (!formData.mobile.trim()) errors.mobile = "شماره موبایل الزامی است";
    else if (!/^09\d{9}$/.test(normalizeNumber(formData.mobile))) {
      errors.mobile = "فرمت موبایل نامعتبر است (مثال: 09123456789)";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingContact) {
        await apiRequest(`/api/contacts/${editingContact.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        showToast("مخاطب به‌روزرسانی شد.");
      } else {
        await apiRequest("/api/contacts", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showToast("مخاطب جدید اضافه شد.");
      }
      closeModal();
      await loadContacts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در ذخیره", true);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    setDeletingId(id);
    setConfirmOpen(true);
  }

  async function handleDelete() {
    if (deletingId === null) return;
    try {
      await apiRequest(`/api/contacts/${deletingId}`, { method: "DELETE" });
      showToast("مخاطب حذف شد.");
      await loadContacts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "خطا در حذف", true);
    } finally {
      setConfirmOpen(false);
      setDeletingId(null);
    }
  }

  function handleSendTo(c: ContactDetail) {
    if (onSendTo) onSendTo(c);
  }

  const filteredContacts = contacts.filter((c) => {
    const q = normalizeNumber(search).toLowerCase();
    if (!q) return true;
    return (
      c.mobile.includes(q) ||
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q)
    );
  });

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold">دفترچه تلفن پیشرفته</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجو نام، نام خانوادگی، شرکت، موبایل..."
              className="pl-10 pr-4"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode("table")} className={viewMode === "table" ? "bg-blue-600 text-white" : ""}>
              جدول
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewMode("card")} className={viewMode === "card" ? "bg-blue-600 text-white" : ""}>
              کارت
            </Button>
            <Button onClick={openAddModal} className="gap-2" disabled={saving}>
              <Plus className="h-4 w-4" />
              افزودن مخاطب
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card className="py-12 text-center">
          <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg text-muted-foreground">مخاطبی یافت نشد</p>
          <Button variant="outline" className="mt-4" onClick={openAddModal}>
            <Plus className="h-4 w-4 ml-2" /> اولین مخاطب را اضافه کنید
          </Button>
        </Card>
      ) : viewMode === "table" ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">نام</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">موبایل</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">تلفن ثابت</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">شرکت / بخش</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">شهر / استان</th>
                  <th className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {c.first_name} {c.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="fa-nums font-medium font-mono text-blue-600 dark:text-blue-400">
                        {faDigits(c.mobile)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {c.landline ? faDigits(c.landline) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      <div>{c.company || "—"}</div>
                      {c.department && <span className="text-xs text-muted-foreground">{c.department}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {c.city || "—"} / {c.province || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {onSendTo && (
                          <Button variant="ghost" size="sm" onClick={() => handleSendTo(c)} className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20" title="ارسال پیامک">
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(c)} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20" title="ویرایش">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => confirmDelete(c.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" title="حذف">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardContent className="flex-1 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-lg">
                      {c.first_name[0] || "?"}{c.last_name[0] || ""}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        {c.first_name} {c.last_name}
                      </h3>
                      {c.company && (
                        <p className="text-sm text-muted-foreground">{c.company}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onSendTo && (
                      <Button variant="ghost" size="sm" onClick={() => handleSendTo(c)} className="text-green-600" title="ارسال پیامک">
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(c)} className="text-blue-600" title="ویرایش">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => confirmDelete(c.id)} className="text-red-600" title="حذف">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="fa-nums font-mono font-medium">{faDigits(c.mobile)}</span>
                  </div>
                  {c.landline && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span className="fa-nums">{faDigits(c.landline)}</span>
                    </div>
                  )}
                  {c.department && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>{c.department}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{c.city || "—"} / {c.province || "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editingContact ? "ویرایش مخاطب" : "افزودن مخاطب جدید"}>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="first_name">نام *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className={cn("mt-1", formErrors.first_name && "border-red-500 focus:ring-red-500")}
              />
              {formErrors.first_name && <p className="mt-1 text-xs text-red-500">{formErrors.first_name}</p>}
            </div>
            <div>
              <Label htmlFor="last_name">نام خانوادگی *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className={cn("mt-1", formErrors.last_name && "border-red-500 focus:ring-red-500")}
              />
              {formErrors.last_name && <p className="mt-1 text-xs text-red-500">{formErrors.last_name}</p>}
            </div>
            <div>
              <Label htmlFor="mobile">موبایل *</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="09123456789"
                className={cn("mt-1", formErrors.mobile && "border-red-500 focus:ring-red-500")}
              />
              {formErrors.mobile && <p className="mt-1 text-xs text-red-500">{formErrors.mobile}</p>}
            </div>
            <div>
              <Label htmlFor="landline">تلفن ثابت</Label>
              <Input
                id="landline"
                value={formData.landline}
                onChange={(e) => setFormData({ ...formData, landline: e.target.value })}
                placeholder="021xxxxxxx"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="city">شهر</Label>
              <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="province">استان</Label>
              <Input id="province" value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="company">شرکت / سازمان</Label>
              <Input id="company" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="department">بخش / واحد</Label>
              <Input id="department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
            <Button type="button" variant="outline" onClick={closeModal}>انصراف</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={handleDelete}
        onCancel={() => { setConfirmOpen(false); setDeletingId(null); }}
        title="حذف مخاطب"
        description="آیا از حذف این مخاطب مطمئن هستید؟ این عمل قابل بازگشت نیست."
        busy={saving}
      />
    </div>
  );
}