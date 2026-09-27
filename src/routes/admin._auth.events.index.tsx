import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { adminEventsQuery, formatDateRange, isEventOver, rupiah, type AdminEvent } from "@/lib/events";

export const Route = createFileRoute("/admin/_auth/events/")({
  head: () => ({ meta: [{ title: "Kelola Event — Admin" }, { name: "robots", content: "noindex" }] }),
  component: EventsAdmin,
});

function EventsAdmin() {
  const { data, isLoading, isError } = useQuery(adminEventsQuery);
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<AdminEvent | null>(null);

  async function remove() {
    if (!toDelete) return;
    const { error } = await supabase.from("events").delete().eq("id", toDelete.id);
    if (error) toast.error("Gagal menghapus event.");
    else toast.success("Event dihapus.");
    setToDelete(null);
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Semua event yang Anda buat. Klik “Pendaftar” untuk mengelola peserta.</p>
        <Button asChild className="rounded-xl">
          <Link to="/admin/events/new"><Plus className="size-4" /> Buat event</Link>
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="size-5 animate-spin text-primary" />
      ) : isError ? (
        <p className="text-sm text-destructive">Gagal memuat event.</p>
      ) : data!.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          Belum ada event. Klik “Buat event” untuk menambahkan.
        </div>
      ) : (
        <div className="grid gap-4">
          {data!.map((e) => {
            const total = e.event_registrations.length;
            const pending = e.event_registrations.filter((r) => r.status === "pending").length;
            return (
              <div key={e.id} className="surface-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <img src={e.poster_url} alt="" className="h-28 w-22 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold">{e.title}</h3>
                    {!e.is_published && <Badge>Draf</Badge>}
                    {isEventOver(e) ? <Badge>Selesai</Badge> : !e.registration_open && <Badge>Pendaftaran ditutup</Badge>}
                    <Badge>{e.is_paid ? rupiah(e.price) : "Gratis"}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" /> {formatDateRange(e.start_date, e.end_date)} · {e.location}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm">
                    <Users className="size-4 text-primary" /> {total} pendaftar
                    {pending > 0 && <span className="ml-2 rounded-full bg-lime/30 px-2 py-0.5 text-xs font-semibold text-forest-deep">{pending} menunggu verifikasi</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="rounded-xl">
                    <Link to="/admin/events/$id" params={{ id: e.id }}><Users className="size-4" /> Pendaftar</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to="/admin/events/$id/edit" params={{ id: e.id }}><Pencil className="size-4" /> Edit</Link>
                  </Button>
                  {e.is_published && (
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                      <a href={`/events/${e.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Lihat</a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setToDelete(e)} aria-label="Hapus event">
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
            <AlertDialogTitle>Hapus event?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” beserta seluruh data pendaftarnya akan dihapus permanen.
            </AlertDialogDescription>
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

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-soft px-2.5 py-0.5 text-xs font-medium">{children}</span>;
}
