import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import QrScanner from "qr-scanner";
import {
  Award,
  BadgeCheck,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  ScanLine,
  TicketX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateRange, rupiah, REG_STATUS, type RegStatus, type Registration } from "@/lib/events";

export const Route = createFileRoute("/admin/_auth/scan")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    eventId: typeof search.eventId === "string" ? search.eventId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scan Tiket — Admin ECO-DIGITAL EVENT KIT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

type Found = Registration & { events: { title: string; start_date: string; end_date: string; location: string } | null };

function ScanPage() {
  const { eventId } = Route.useSearch();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState<Found[]>([]);
  const lastCode = useRef<string>("");
  const [generating, setGenerating] = useState(false);
  const [pendingCerts, setPendingCerts] = useState(0);

  // Load recent check-ins for the event
  useEffect(() => {
    if (!eventId) return;
    
    async function loadRecent() {
      const { data } = await supabase
        .from("event_registrations")
        .select("*, events(title, start_date, end_date, location)")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(10);
      
      if (data) setRecentCheckIns(data as Found[]);
      
      // Count pending certificates
      if (data && data.length > 0) {
        const regIds = data.map(r => r.id);
        const { data: certs } = await supabase
          .from("certificates")
          .select("registration_id")
          .in("registration_id", regIds);
        
        const certsMap = new Set((certs || []).map(c => c.registration_id));
        const pending = data.filter(r => !certsMap.has(r.id)).length;
        setPendingCerts(pending);
      }
    }
    
    void loadRecent();
  }, [eventId, recentCheckIns.length]); // Refresh when check-ins change

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  async function startCamera() {
    if (!videoRef.current) return;
    setCamError(null);
    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const code = result.data.trim();
          if (code && code !== lastCode.current) {
            lastCode.current = code;
            void lookup(code);
          }
        },
        { returnDetailedScanResult: true, highlightScanRegion: true },
      );
      await scanner.start();
      scannerRef.current = scanner;
      setCamOn(true);
    } catch {
      setCamError("Kamera tidak bisa diakses. Izinkan akses kamera atau gunakan input kode manual.");
    }
  }

  function stopCamera() {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamOn(false);
  }

  async function lookup(code: string) {
    setBusy(true);
    setNotFound(false);
    setFound(null);
    // Kode tiket bisa berupa kode mentah atau URL halaman tiket yang disalin.
    const cleaned = code.includes("/tiket/") ? code.split("/tiket/").pop()!.split(/[?#]/)[0]! : code;
    
    let query = supabase
      .from("event_registrations")
      .select("*, events(title, start_date, end_date, location)")
      .eq("ticket_code", cleaned);
    
    // Filter by event if eventId is provided
    if (eventId) {
      query = query.eq("event_id", eventId);
    }
    
    const { data, error } = await query.maybeSingle();
    
    setBusy(false);
    if (error) {
      toast.error("Gagal memeriksa tiket: " + error.message);
      return;
    }
    if (!data) {
      setNotFound(true);
      return;
    }
    setFound(data as Found);
  }

  async function checkIn() {
    if (!found) return;
    setBusy(true);
    const { error } = await supabase
      .from("event_registrations")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", found.id);
    setBusy(false);
    if (error) {
      toast.error("Gagal check-in: " + error.message);
      return;
    }
    toast.success(`${found.name} berhasil check-in`);
    const updatedFound = { ...found, checked_in_at: new Date().toISOString() };
    setFound(updatedFound);
    
    // Add to recent check-ins list if filtering by event
    if (eventId) {
      setRecentCheckIns((prev) => [updatedFound, ...prev.slice(0, 9)]);
    }
  }

  function reset() {
    setFound(null);
    setNotFound(false);
    setManual("");
    lastCode.current = "";
  }

  async function generateCertificates() {
    if (!eventId) {
      toast.error("Event ID tidak ditemukan");
      return;
    }

    setGenerating(true);
    
    try {
      const response = await fetch("/api/admin/generate-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate certificates");
      }

      toast.success(result.message || `${result.processed} sertifikat berhasil di-generate!`);
      setPendingCerts(0); // Reset count
      
      // Refresh recent check-ins to update status
      const { data } = await supabase
        .from("event_registrations")
        .select("*, events(title, start_date, end_date, location)")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(10);
      
      if (data) setRecentCheckIns(data as Found[]);
    } catch (error) {
      console.error("[Scan] Generate certificates error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal generate sertifikat");
    } finally {
      setGenerating(false);
    }
  }

  const status = found ? REG_STATUS[found.status as RegStatus] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Scan Tiket</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arahkan kamera ke QR tiket peserta, atau masukkan kode tiket secara manual.
          </p>
        </div>
        {eventId && pendingCerts > 0 && (
          <Button 
            onClick={generateCertificates} 
            disabled={generating}
            className="rounded-xl"
            size="sm"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Award className="size-4" />
                Generate Sertifikat ({pendingCerts})
              </>
            )}
          </Button>
        )}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="relative aspect-[4/3] bg-forest-deep/95">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-forest-foreground/70">
              <ScanLine className="size-10" />
              <p className="text-sm">Kamera belum aktif</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5">
          {camError && <p className="text-sm text-destructive">{camError}</p>}
          <div className="flex gap-2">
            {camOn ? (
              <Button variant="outline" onClick={stopCamera} className="rounded-xl">
                <CameraOff className="size-4" /> Matikan kamera
              </Button>
            ) : (
              <Button onClick={startCamera} className="rounded-xl">
                <Camera className="size-4" /> Nyalakan kamera
              </Button>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) void lookup(manual.trim());
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Atau ketik kode tiket…"
              className="rounded-xl font-mono text-sm"
            />
            <Button type="submit" variant="secondary" disabled={busy || !manual.trim()} className="rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Cek"}
            </Button>
          </form>
        </div>
      </div>

      {notFound && (
        <div className="surface-card flex items-center gap-3 border-destructive/40 p-5">
          <TicketX className="size-6 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Tiket tidak ditemukan</p>
            <p className="text-sm text-muted-foreground">Pastikan kode benar atau QR berasal dari tiket resmi.</p>
          </div>
        </div>
      )}

      {found && status && (
        <div className="surface-card space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase">Peserta</p>
              <h3 className="mt-1 font-display text-xl font-bold">{found.name}</h3>
              <p className="text-sm text-muted-foreground">{found.email} · {found.whatsapp}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
          </div>

          {found.events && (
            <div className="rounded-xl bg-soft p-4 text-sm">
              <p className="font-semibold">{found.events.title}</p>
              <p className="mt-1 text-muted-foreground">
                {formatDateRange(found.events.start_date, found.events.end_date)} · {found.events.location}
              </p>
            </div>
          )}

          {found.amount > 0 && (
            <p className="text-sm text-muted-foreground">
              Pembayaran: {rupiah(found.amount)} via {found.payment_method ?? "-"}
            </p>
          )}

          {found.status !== "approved" ? (
            <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4">
              <XCircle className="size-6 shrink-0 text-destructive" />
              <p className="text-sm">
                {found.status === "pending"
                  ? "Pendaftaran belum disetujui — pembayaran masih menunggu verifikasi. Check-in tidak bisa dilakukan."
                  : "Pendaftaran ini ditolak. Check-in tidak bisa dilakukan."}
              </p>
            </div>
          ) : found.checked_in_at ? (
            <div className="flex items-center gap-3 rounded-xl bg-lime/20 p-4">
              <BadgeCheck className="size-6 shrink-0 text-forest" />
              <div>
                <p className="font-semibold">Sudah check-in</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(found.checked_in_at).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          ) : (
            <Button onClick={checkIn} disabled={busy} className="w-full rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Check-in sekarang
            </Button>
          )}

          <Button variant="ghost" onClick={reset} className="w-full rounded-xl">
            Scan tiket lain
          </Button>
        </div>
      )}

      {eventId && recentCheckIns.length > 0 && (
        <div className="surface-card space-y-4 p-6">
          <h3 className="font-display text-lg font-bold">Check-in Terbaru</h3>
          <div className="space-y-2">
            {recentCheckIns.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between gap-3 rounded-lg bg-soft p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{reg.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{reg.email}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {reg.checked_in_at && new Date(reg.checked_in_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
