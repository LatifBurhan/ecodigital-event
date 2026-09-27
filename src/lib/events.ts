import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EventRow = Tables<"events">;
export type Registration = Tables<"event_registrations">;
export type SocialLink = { platform: string; url: string };
export type PaymentMethod = { name: string; account_number: string; account_name: string };

export const SOCIAL_PLATFORMS = [
  "Instagram",
  "TikTok",
  "X",
  "Threads",
  "YouTube",
  "Facebook",
  "Website",
  "Lainnya",
] as const;

export const REG_STATUS = {
  pending: { label: "Menunggu Verifikasi", cls: "bg-lime/25 text-forest-deep border-lime/50" },
  approved: { label: "Disetujui", cls: "bg-forest text-forest-foreground border-forest" },
  rejected: { label: "Ditolak", cls: "bg-destructive/10 text-destructive border-destructive/30" },
} as const;
export type RegStatus = keyof typeof REG_STATUS;

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function d(s: string) {
  return new Date(s + "T00:00:00");
}

export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  if (start === end) return d(start).toLocaleDateString("id-ID", { weekday: "long", ...opts });
  const a = d(start);
  const b = d(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.toLocaleDateString("id-ID", opts)}`;
  return `${a.toLocaleDateString("id-ID", opts)} – ${b.toLocaleDateString("id-ID", opts)}`;
}

export function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function isEventOver(e: Pick<EventRow, "end_date">) {
  return e.end_date < todayISO();
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "event"
  );
}

export const asSocials = (v: unknown) => (Array.isArray(v) ? (v as SocialLink[]) : []);
export const asPayments = (v: unknown) => (Array.isArray(v) ? (v as PaymentMethod[]) : []);

/* ---------- Admin (browser client, RLS: admin only) ---------- */

export type AdminEvent = EventRow & { event_registrations: { status: string }[] };

export const adminEventsQuery = queryOptions({
  queryKey: ["admin", "events"],
  queryFn: async (): Promise<AdminEvent[]> => {
    const { data, error } = await supabase
      .from("events")
      .select("*, event_registrations(status)")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminEvent[];
  },
});

export const adminEventQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const adminRegistrationsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["admin", "registrations", eventId],
    queryFn: async (): Promise<Registration[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export async function uploadPoster(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("event-posters").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  // Signed URL berlaku 10 tahun agar poster bisa tampil publik dari bucket privat.
  const { data, error: e2 } = await supabase.storage
    .from("event-posters")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw e2 ?? new Error("Gagal membuat URL poster");
  return data.signedUrl;
}

export async function openProof(path: string) {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
  if (error || !data) throw error ?? new Error("Gagal membuka bukti");
  window.open(data.signedUrl, "_blank", "noopener");
}

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportRegistrationsCsv(event: EventRow, rows: Registration[]) {
  const header = ["Tanggal Daftar", "Nama", "Email", "WhatsApp", "Status", "Metode Bayar", "Nominal", "Kode Tiket", "Check-in"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        new Date(r.created_at).toLocaleString("id-ID"),
        r.name,
        r.email,
        r.whatsapp,
        REG_STATUS[r.status as RegStatus]?.label ?? r.status,
        r.payment_method ?? "",
        r.amount,
        r.ticket_code,
        r.checked_in_at ? new Date(r.checked_in_at).toLocaleString("id-ID") : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pendaftar-${event.slug}-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
