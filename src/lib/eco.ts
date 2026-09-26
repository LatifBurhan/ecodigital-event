export const EVENT_TYPES = [
  "Conference",
  "Seminar",
  "Workshop",
  "Meeting",
  "Exhibition",
  "Lainnya",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const STATUSES = ["Baru", "Dihubungi", "Dalam Proses", "Selesai"] as const;
export type InquiryStatus = (typeof STATUSES)[number];

/** Asumsi simulasi (ilustratif, bukan hasil audit lingkungan). */
export const ASSUMPTIONS = {
  gramPerSheet: 5,
  co2GramPerSheet: 5,
};

export function calcImpact(participants: number, docsPerParticipant: number) {
  const sheets = Math.max(0, Math.round(participants * docsPerParticipant));
  const paperKg = (sheets * ASSUMPTIONS.gramPerSheet) / 1000;
  const co2Kg = (sheets * ASSUMPTIONS.co2GramPerSheet) / 1000;
  return { sheets, paperKg, co2Kg };
}

export const nf = new Intl.NumberFormat("id-ID");
export const nf1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function formatDateID(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normalisasi nomor Indonesia: 08xx / 62xx / +62xx -> 62xx */
export function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}

export function whatsappLink(number: string, organizerName: string) {
  const message = `Halo ${organizerName}, kami dari tim ECO-DIGITAL EVENT KIT. Terima kasih telah mengirimkan minat kemitraan. Kami ingin berdiskusi lebih lanjut mengenai kebutuhan digitalisasi acara Anda.`;
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(message)}`;
}

export const STATUS_STYLES: Record<InquiryStatus, string> = {
  Baru: "bg-lime/25 text-forest-deep border-lime/50",
  Dihubungi: "bg-mint/25 text-forest-deep border-mint/50",
  "Dalam Proses": "bg-soft text-forest border-border",
  Selesai: "bg-forest text-forest-foreground border-forest",
};
