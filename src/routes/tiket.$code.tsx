import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, Clock, Loader2, MapPin, XCircle } from "lucide-react";
import { toast } from "sonner";

import { SiteNav } from "@/components/landing/SiteNav";
import { Button } from "@/components/ui/button";
import { ticketQuery } from "@/lib/events.functions";
import { formatDateRange, rupiah } from "@/lib/events";

export const Route = createFileRoute("/tiket/$code")({
  head: () => ({
    meta: [
      { title: "Tiket Event — ECO-DIGITAL EVENT KIT" },
      { name: "description", content: "Tiket digital dan kode QR pendaftaran event Anda." },
      { property: "og:title", content: "Tiket Event — ECO-DIGITAL EVENT KIT" },
      { property: "og:description", content: "Tiket digital dan kode QR pendaftaran event Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { code } = Route.useParams();
  const { data: t, isLoading, isError, refetch } = useQuery(ticketQuery(code));

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <main className="mx-auto max-w-md px-5 py-10">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : isError || !t ? (
          <div className="surface-card p-8 text-center">
            <p className="font-semibold">Tiket tidak ditemukan.</p>
            <Link to="/" className="mt-3 inline-block text-sm text-primary underline">Kembali ke beranda</Link>
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="bg-forest p-6 text-forest-foreground">
              <p className="font-mono text-[0.68rem] tracking-[0.2em] text-mint uppercase">E-Ticket</p>
              <h1 className="mt-2 font-display text-2xl font-bold">{t.event_title}</h1>
              <ul className="mt-4 space-y-1.5 text-sm text-forest-foreground/85">
                <li className="flex gap-2"><CalendarDays className="size-4" />{formatDateRange(t.start_date, t.end_date)}</li>
                <li className="flex gap-2"><MapPin className="size-4" />{t.location}</li>
              </ul>
            </div>
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <p className="text-sm text-muted-foreground">Atas nama</p>
              <p className="-mt-3 font-display text-xl font-bold">{t.name}</p>

              {t.status === "approved" ? (
                <>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <QRCodeSVG value={t.ticket_code} size={220} level="M" />
                  </div>
                  <p className="font-mono text-xs break-all text-muted-foreground">{t.ticket_code}</p>
                  <p className="text-sm">Tunjukkan QR ini saat check-in di lokasi.</p>
                </>
              ) : t.status === "pending" ? (
                <div className="rounded-2xl bg-lime/20 p-5">
                  <Clock className="mx-auto size-8 text-forest" />
                  <p className="mt-2 font-semibold">Menunggu verifikasi pembayaran</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pembayaran {rupiah(t.amount)} sedang dicek admin. QR tiket muncul di halaman ini setelah disetujui.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => refetch()}>Cek status</Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-destructive/10 p-5">
                  <XCircle className="mx-auto size-8 text-destructive" />
                  <p className="mt-2 font-semibold">Pendaftaran ditolak</p>
                  <p className="mt-1 text-sm text-muted-foreground">Bukti pembayaran tidak valid. Silakan hubungi penyelenggara.</p>
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full rounded-full"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link tiket disalin");
                }}
              >
                Salin link tiket
              </Button>
              <p className="text-xs text-muted-foreground">Simpan link halaman ini untuk membuka tiket Anda kembali.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
