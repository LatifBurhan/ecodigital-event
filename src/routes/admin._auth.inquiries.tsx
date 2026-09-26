import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Loader2, MessageCircle, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteInquiry,
  exportInquiriesCsv,
  inquiriesQuery,
  updateInquiryStatus,
  type Inquiry,
} from "@/lib/inquiries";
import {
  EVENT_TYPES,
  STATUSES,
  STATUS_STYLES,
  formatDateID,
  whatsappLink,
  type InquiryStatus,
} from "@/lib/eco";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_auth/inquiries")({
  head: () => ({ meta: [{ title: "Data Pendaftar — ECO-DIGITAL EVENT KIT" }] }),
  component: InquiriesPage,
});

const PAGE_SIZE = 10;

function InquiriesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(inquiriesQuery);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Inquiry | null>(null);
  const [toDelete, setToDelete] = useState<Inquiry | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatus }) =>
      updateInquiryStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inquiriesQuery.queryKey });
      toast.success("Status berhasil diperbarui.");
    },
    onError: () => toast.error("Gagal memperbarui status."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInquiry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inquiriesQuery.queryKey });
      toast.success("Data pendaftar berhasil dihapus.");
      setToDelete(null);
      setDetail(null);
    },
    onError: () => toast.error("Gagal menghapus data."),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      const matchSearch =
        !q ||
        r.organizer_name.toLowerCase().includes(q) ||
        r.institution.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || r.event_type === typeFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [data, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat data pendaftar...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="surface-card p-8 text-sm text-destructive">
        Gagal memuat data pendaftar. Silakan muat ulang halaman.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, institusi, atau email..."
            className="pl-9"
            aria-label="Cari pendaftar"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter tipe acara"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua tipe acara</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
            <RotateCcw className="size-4" /> Reset
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => exportInquiriesCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" /> Export to CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card p-14 text-center">
          <p className="font-display text-lg font-semibold">Belum ada data pendaftar</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.length === 0
              ? "Formulir minat mitra dari landing page akan muncul di sini."
              : "Tidak ada data yang cocok dengan pencarian atau filter saat ini."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="surface-card hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Tanggal", "Penyelenggara", "Tipe", "Durasi", "Kontak", "Status", "Aksi"].map(
                    (h) => (
                      <th key={h} className="px-5 py-4 font-mono text-[0.66rem] tracking-[0.14em] text-muted-foreground uppercase">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-4 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateID(r.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{r.organizer_name}</p>
                      <p className="text-xs text-muted-foreground">{r.institution}</p>
                    </td>
                    <td className="px-5 py-4">{r.event_type}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{r.duration_days} hari</td>
                    <td className="px-5 py-4">
                      <p className="text-xs">{r.email}</p>
                      <p className="text-xs text-muted-foreground">{r.whatsapp}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusSelect
                        value={r.status as InquiryStatus}
                        onChange={(status) => statusMutation.mutate({ id: r.id, status })}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <IconButton label="Detail" onClick={() => setDetail(r)}>
                          <Eye className="size-4" />
                        </IconButton>
                        <a
                          href={whatsappLink(r.whatsapp, r.organizer_name)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Hubungi via WhatsApp"
                          className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-secondary"
                        >
                          <MessageCircle className="size-4" />
                        </a>
                        <IconButton label="Hapus" destructive onClick={() => setToDelete(r)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <div key={r.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.organizer_name}</p>
                    <p className="text-xs text-muted-foreground">{r.institution}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-[0.68rem] font-medium whitespace-nowrap",
                      STATUS_STYLES[r.status as InquiryStatus],
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDateID(r.created_at)} · {r.event_type} · {r.duration_days} hari
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setDetail(r)}>
                    <Eye className="size-4" /> Detail
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" asChild>
                    <a href={whatsappLink(r.whatsapp, r.organizer_name)} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setToDelete(r)}>
                    <Trash2 className="size-4" /> Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Menampilkan {rows.length} dari {filtered.length} data
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                Sebelumnya
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                {current} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={current >= totalPages}
                onClick={() => setPage(current + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.organizer_name}</DialogTitle>
            <DialogDescription>{detail?.institution}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <Info label="Tipe acara" value={detail.event_type} />
                <Info label="Durasi" value={`${detail.duration_days} hari`} />
                <Info
                  label="Estimasi peserta"
                  value={detail.estimated_participants?.toString() ?? "Tidak diisi"}
                />
                <Info label="Tanggal submit" value={formatDateID(detail.created_at)} />
                <Info label="Email" value={detail.email} />
                <Info label="WhatsApp" value={detail.whatsapp} />
              </dl>
              <div>
                <p className="eyebrow">Catatan kebutuhan</p>
                <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">
                  {detail.notes?.trim() || "Tidak ada catatan."}
                </p>
              </div>
              <div>
                <p className="eyebrow">Ubah status</p>
                <div className="mt-2">
                  <StatusSelect
                    value={detail.status as InquiryStatus}
                    onChange={(status) => {
                      statusMutation.mutate({ id: detail.id, status });
                      setDetail({ ...detail, status });
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild className="rounded-xl">
                  <a
                    href={whatsappLink(detail.whatsapp, detail.organizer_name)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> Hubungi via WhatsApp
                  </a>
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setDetail(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data pendaftar?</AlertDialogTitle>
            <AlertDialogDescription>
              Data <strong>{toDelete?.organizer_name}</strong> akan dihapus secara permanen dan
              tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) deleteMutation.mutate(toDelete.id);
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: InquiryStatus;
  onChange: (s: InquiryStatus) => void;
}) {
  return (
    <select
      aria-label="Ubah status"
      value={value}
      onChange={(e) => onChange(e.target.value as InquiryStatus)}
      className={cn(
        "h-9 rounded-full border px-3 text-xs font-medium",
        STATUS_STYLES[value],
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-card text-foreground">
          {s}
        </option>
      ))}
    </select>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  destructive,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl border border-border transition-colors hover:bg-secondary",
        destructive ? "text-destructive" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}
