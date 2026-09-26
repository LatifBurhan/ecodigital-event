import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateID, type InquiryStatus } from "@/lib/eco";

export type Inquiry = Tables<"partner_inquiries">;

export const inquiriesQuery = queryOptions({
  queryKey: ["partner_inquiries"],
  queryFn: async (): Promise<Inquiry[]> => {
    const { data, error } = await supabase
      .from("partner_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export async function updateInquiryStatus(id: string, status: InquiryStatus) {
  const { error } = await supabase.from("partner_inquiries").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteInquiry(id: string) {
  const { error } = await supabase.from("partner_inquiries").delete().eq("id", id);
  if (error) throw error;
}

const CSV_HEADERS = [
  "Tanggal Submit",
  "Nama Penyelenggara",
  "Institusi",
  "Tipe Acara",
  "Durasi (hari)",
  "Estimasi Peserta",
  "Email",
  "WhatsApp",
  "Catatan Kebutuhan",
  "Status",
];

function csvCell(value: string | number | null) {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportInquiriesCsv(rows: Inquiry[]) {
  const lines = [
    CSV_HEADERS.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        formatDateID(r.created_at),
        r.organizer_name,
        r.institution,
        r.event_type,
        r.duration_days,
        r.estimated_participants ?? "",
        r.email,
        r.whatsapp,
        r.notes ?? "",
        r.status,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eco-digital-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
