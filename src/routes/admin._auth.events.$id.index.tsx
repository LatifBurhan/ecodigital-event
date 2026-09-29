import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Award, Check, Download, FileImage, Loader2, MessageCircle, RefreshCw, Search, Trash2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  REG_STATUS,
  adminEventQuery,
  adminRegistrationsQuery,
  exportRegistrationsCsv,
  formatDateRange,
  openProof,
  rupiah,
  type RegStatus,
  type Registration,
} from "@/lib/events";
import { formatDateID, nf, waLink } from "@/lib/eco";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_auth/events/$id/")({
  head: () => ({ meta: [{ title: "Pendaftar Event — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Registrations,
});

function Registrations() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const ev = useQuery(adminEventQuery(id));
  const regs = useQuery(adminRegistrationsQuery(id));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | RegStatus>("all");
  const [toDelete, setToDelete] = useState<Registration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (regs.data ?? []).filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!s || [r.name, r.email, r.whatsapp, r.ticket_code].some((v) => v.toLowerCase().includes(s))),
    );
  }, [regs.data, q, status]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  // Helper to get certificate status
  function getCertStatus(r: any): "ready" | "queued" | "error" | "not_attended" {
    if (!r.checked_in_at) return "not_attended";
    if (r.certificates && r.certificates.length > 0) return "ready";
    if (r.certificate_queue && r.certificate_queue.length > 0) {
      const queue = r.certificate_queue[0];
      if (queue.status === "failed") return "error";
      return "queued";
    }
    return "not_attended";
  }

  // Count certificates by status
  const certStats = useMemo(() => {
    const attended = (regs.data ?? []).filter(r => r.checked_in_at);
    return {
      ready: attended.filter(r => getCertStatus(r) === "ready").length,
      queued: attended.filter(r => getCertStatus(r) === "queued").length,
      error: attended.filter(r => getCertStatus(r) === "error").length,
    };
  }, [regs.data]);

  // Bulk generate certificates
  async function generateCertificates() {
    setGenerating(true);
    setGenProgress({ current: 0, total: certStats.queued });
    
    try {
      const response = await fetch("/api/admin/generate-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate certificates");
      }

      toast.success(result.message || `${result.processed} sertifikat berhasil di-generate!`);
      refresh();
    } catch (error) {
      console.error("[Admin] Generate certificates error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal generate sertifikat");
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  }

  async function update(r: Registration, patch: Partial<Registration>, msg: string) {
    const { error } = await supabase.from("event_registrations").update(patch).eq("id", r.id);
    if (error) {
      toast.error("Gagal memperbarui data.");
      return;
    }
    toast.success(msg);
    refresh();
  }

  async function remove() {
    if (!toDelete) return;
    const { error } = await supabase.from("event_registrations").delete().eq("id", toDelete.id);
    if (error) toast.error("Gagal menghapus.");
    else toast.success("Pendaftar dihapus.");
    setToDelete(null);
    refresh();
  }

  if (ev.isLoading || regs.isLoading) return <Loader2 className="size-5 animate-spin text-primary" />;
  if (!ev.data) return <p className="text-sm text-muted-foreground">Event tidak ditemukan.</p>;
  const event = ev.data;
  const all = regs.data ?? [];
  const count = (s: RegStatus) => all.filter((r) => r.status === s).length;
  const ticketUrl = (code: string) => `${window.location.origin}/tiket/${code}`;

  return (
    <div className="space-y-6">
      <Link to="/admin/events" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Semua event
      </Link>
      <div className="surface-card flex flex-wrap items-center gap-4 p-5">
        <img src={event.poster_url} alt="" className="h-20 w-16 rounded-lg object-cover" />
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold">{event.title}</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(event.start_date, event.end_date)} · {event.is_paid ? rupiah(event.price) : "Gratis"}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => exportRegistrationsCsv(event, all)} disabled={!all.length}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total pendaftar" value={all.length} />
        <Stat label="Disetujui" value={count("approved")} />
        <Stat label="Menunggu verifikasi" value={count("pending")} />
        <Stat label="Sudah check-in" value={all.filter((r) => r.checked_in_at).length} />
      </div>

      {/* Certificate Generation Section */}
      {certStats.queued > 0 && (
        <div className="surface-card flex flex-wrap items-center gap-4 p-5 border-2 border-primary/20">
          <Award className="size-8 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold">Sertifikat Siap Di-generate</h3>
            <p className="text-sm text-muted-foreground">
              {certStats.queued} peserta yang sudah hadir belum mendapat sertifikat
            </p>
          </div>
          <Button 
            onClick={generateCertificates} 
            disabled={generating}
            className="rounded-xl"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating {genProgress ? `${genProgress.current}/${genProgress.total}` : "..."}
              </>
            ) : (
              <>
                <Award className="size-4" />
                Generate Sertifikat ({certStats.queued})
              </>
            )}
          </Button>
        </div>
      )}

      {certStats.ready > 0 && (
        <div className="surface-card flex flex-wrap items-center gap-3 p-4 bg-mint/10 border border-mint/30">
          <Check className="size-5 text-forest" />
          <p className="text-sm font-medium">
            ✅ {certStats.ready} sertifikat sudah tersedia untuk diunduh peserta
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama, email, WhatsApp, atau kode tiket" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">Semua status</option>
          {(Object.keys(REG_STATUS) as RegStatus[]).map((s) => <option key={s} value={s}>{REG_STATUS[s].label}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">Belum ada pendaftar yang cocok.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const st = REG_STATUS[r.status as RegStatus] ?? REG_STATUS.pending;
            const certStatus = getCertStatus(r);
            const certBadge = {
              ready: { label: "✅ Sertif Ready", cls: "bg-mint/30 text-forest-deep border-mint" },
              queued: { label: "⏳ Pending", cls: "bg-amber-100 text-amber-900 border-amber-300" },
              error: { label: "❌ Error", cls: "bg-destructive/10 text-destructive border-destructive/30" },
              not_attended: { label: "➖ Belum Hadir", cls: "bg-muted text-muted-foreground border-muted" },
            }[certStatus];
            
            return (
              <div key={r.id} className="surface-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{r.name}</p>
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
                    {r.checked_in_at && <span className="rounded-full bg-mint/30 px-2.5 py-0.5 text-xs font-medium text-forest-deep">Hadir</span>}
                    {r.checked_in_at && <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", certBadge.cls)}>{certBadge.label}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.email} · {r.whatsapp}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Daftar {formatDateID(r.created_at)}
                    {r.payment_method && <> · {r.payment_method} · {rupiah(r.amount)}</>}
                    {" · "}<span className="font-mono">{r.ticket_code.slice(0, 10)}…</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Certificate Download Button */}
                  {certStatus === "ready" && (r as any).certificates?.[0]?.certificate_url && (
                    <Button asChild size="sm" variant="outline" className="rounded-xl border-mint text-forest">
                      <a href={(r as any).certificates[0].certificate_url} target="_blank" rel="noopener noreferrer">
                        <Award className="size-4" /> Lihat Sertifikat
                      </a>
                    </Button>
                  )}
                  {/* Certificate Error - Show error message */}
                  {certStatus === "error" && (r as any).certificate_queue?.[0]?.error_message && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="rounded-xl border-destructive text-destructive"
                      onClick={() => toast.error((r as any).certificate_queue[0].error_message)}
                    >
                      <X className="size-4" /> Error Detail
                    </Button>
                  )}
                  {r.payment_proof_path && (
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openProof(r.payment_proof_path!).catch(() => toast.error("Gagal membuka bukti."))}>
                      <FileImage className="size-4" /> Bukti
                    </Button>
                  )}
                  {r.status !== "approved" && (
                    <Button size="sm" className="rounded-xl" onClick={() => update(r, { status: "approved" }, "Pendaftar disetujui.")}>
                      <Check className="size-4" /> Setujui
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => update(r, { status: "rejected" }, "Pendaftar ditolak.")}>
                      <X className="size-4" /> Tolak
                    </Button>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" variant="outline" className="rounded-xl"
                      onClick={() => update(r, { checked_in_at: r.checked_in_at ? null : new Date().toISOString() }, r.checked_in_at ? "Check-in dibatalkan." : "Ditandai hadir.")}>
                      <UserCheck className="size-4" /> {r.checked_in_at ? "Batal hadir" : "Tandai hadir"}
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <a
                      href={waLink(
                        r.whatsapp,
                        r.status === "approved"
                          ? `Halo ${r.name}, pendaftaran Anda untuk "${event.title}" sudah dikonfirmasi. Tiket QR Anda: ${ticketUrl(r.ticket_code)}`
                          : `Halo ${r.name}, kami dari panitia "${event.title}" ingin menginformasikan terkait pendaftaran Anda.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setToDelete(r)} aria-label="Hapus pendaftar">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pendaftar?</AlertDialogTitle>
            <AlertDialogDescription>Data pendaftaran {toDelete?.name} akan dihapus dan tiketnya tidak berlaku lagi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{nf.format(value)}</p>
    </div>
  );
}
