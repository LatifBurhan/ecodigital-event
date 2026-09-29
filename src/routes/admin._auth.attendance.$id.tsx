import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Award, Loader2, ScanLine, Users, UserCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminEventQuery } from "@/lib/events";
import { formatDateID, nf } from "@/lib/eco";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { generateCertificates as generateCertificatesServerFn } from "@/lib/generate-certificates";

export const Route = createFileRoute("/admin/_auth/attendance/$id")({
  head: () => ({ 
    meta: [
      { title: "Daftar Hadir Event — Admin" }, 
      { name: "robots", content: "noindex" }
    ] 
  }),
  component: EventAttendance,
});

interface AttendanceRecord {
  id: string;
  ticket_code: string;
  name: string;
  email: string;
  whatsapp: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
}

function EventAttendance() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [pendingCerts, setPendingCerts] = useState(0);
  const [hasTemplate, setHasTemplate] = useState(false);

  console.log("[EventAttendance] Event ID:", id);

  const eventQuery = useQuery(adminEventQuery(id));

  console.log("[EventAttendance] Event query:", {
    isLoading: eventQuery.isLoading,
    isError: eventQuery.isError,
    error: eventQuery.error,
    data: eventQuery.data,
  });

  const attendanceQuery = useQuery({
    queryKey: ["admin", "attendance", id],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id, ticket_code, name, email, whatsapp, status, checked_in_at, created_at")
        .eq("event_id", id)
        .eq("status", "approved")
        .order("checked_in_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("[Attendance] Error loading registrations:", error);
        throw error;
      }
      return data || [];
    },
  });

  const event = eventQuery.data;
  const attendance = attendanceQuery.data || [];
  const checkedIn = attendance.filter((a) => a.checked_in_at);
  const notCheckedIn = attendance.filter((a) => !a.checked_in_at);
  const total = attendance.length;
  const attendanceRate = total > 0 ? Math.round((checkedIn.length / total) * 100) : 0;

  // Check if event has certificate template
  useEffect(() => {
    async function checkTemplate() {
      const { data } = await supabase
        .from("certificate_templates")
        .select("id")
        .eq("event_id", id)
        .single();
      
      setHasTemplate(!!data);
    }

    void checkTemplate();
  }, [id]);

  // Count pending certificates
  useEffect(() => {
    if (checkedIn.length === 0) {
      setPendingCerts(0);
      return;
    }

    async function countPending() {
      const regIds = checkedIn.map(r => r.id);
      const { data: certs } = await supabase
        .from("certificates")
        .select("registration_id")
        .in("registration_id", regIds);
      
      const certsMap = new Set((certs || []).map(c => c.registration_id));
      const pending = checkedIn.filter(r => !certsMap.has(r.id)).length;
      setPendingCerts(pending);
    }

    void countPending();
  }, [checkedIn.length]);

  async function generateCertificates() {
    setGenerating(true);
    
    try {
      console.log("[Attendance] Generating certificates for event:", id);
      
      // Call server function
      const result = await generateCertificatesServerFn({ data: { eventId: id } });
      
      console.log("[Attendance] Generation result:", result);
      
      if (result.success) {
        toast.success(result.message || `${result.processed} sertifikat berhasil di-generate!`);
        setPendingCerts(0);
        qc.invalidateQueries({ queryKey: ["admin", "attendance", id] });
      } else {
        throw new Error(result.error || "Failed to generate certificates");
      }
    } catch (error) {
      console.error("[Attendance] Generate certificates error:", error);
      const errorMessage = error instanceof Error ? error.message : "Gagal generate sertifikat";
      toast.error(errorMessage);
      
      if (error instanceof Error) {
        console.error("[Attendance] Error stack:", error.stack);
      }
    } finally {
      setGenerating(false);
    }
  }

  function exportCsv() {
    if (!event || !attendance.length) return;

    const headers = ["No", "Nama", "Email", "WhatsApp", "Waktu Check-in", "Ticket Code"];
    const rows = checkedIn.map((a, i) => [
      (i + 1).toString(),
      a.name,
      a.email,
      a.whatsapp,
      a.checked_in_at ? formatDateID(a.checked_in_at) : "-",
      a.ticket_code,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `daftar-hadir-${event.slug}-${Date.now()}.csv`;
    link.click();
  }

  if (eventQuery.isLoading || attendanceQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (eventQuery.isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-semibold">Gagal memuat event</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {eventQuery.error instanceof Error ? eventQuery.error.message : "Unknown error"}
        </p>
        <Link to="/admin/attendance" className="mt-4 inline-block text-primary underline">
          Kembali
        </Link>
      </div>
    );
  }

  if (attendanceQuery.isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-semibold">Gagal memuat daftar pendaftar</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {attendanceQuery.error instanceof Error ? attendanceQuery.error.message : "Unknown error"}
        </p>
        <Link to="/admin/attendance" className="mt-4 inline-block text-primary underline">
          Kembali
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Event tidak ditemukan.</p>
        <Link to="/admin/attendance" className="mt-4 inline-block text-primary underline">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/admin/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="size-4" /> Daftar Hadir
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold line-clamp-2">{event.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{event.location}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="surface-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{nf.format(total)}</p>
              <p className="text-xs text-muted-foreground">Total Terdaftar</p>
            </div>
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <UserCheck className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{nf.format(checkedIn.length)}</p>
              <p className="text-xs text-muted-foreground">Sudah Hadir</p>
            </div>
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <span className="text-lg font-bold text-primary">{attendanceRate}%</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Tingkat Kehadiran</p>
              <div className="mt-1 h-2 w-24 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button asChild className="rounded-full">
          <Link to="/admin/scan" search={{ eventId: id }}>
            <ScanLine className="size-4 mr-2" /> Scan QR Tiket
          </Link>
        </Button>

        {hasTemplate && checkedIn.length > 0 && (
          <Button 
            onClick={generateCertificates} 
            disabled={generating}
            className="rounded-full"
            variant={pendingCerts > 0 ? "default" : "outline"}
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Award className="size-4 mr-2" />
                {pendingCerts > 0 
                  ? `Generate Sertifikat (${pendingCerts} pending)` 
                  : "Generate Sertifikat"}
              </>
            )}
          </Button>
        )}

        {!hasTemplate && checkedIn.length > 0 && (
          <div className="rounded-full border border-dashed border-muted-foreground/50 px-4 py-2 text-sm text-muted-foreground">
            <Award className="size-4 inline mr-2" />
            Upload template sertifikat di event settings untuk enable generate
          </div>
        )}

        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={checkedIn.length === 0}
          className="rounded-full"
        >
          <Download className="size-4 mr-2" /> Export CSV ({checkedIn.length})
        </Button>
      </div>

      {/* Attendance List */}
      <div className="surface-card">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-xl font-bold">
            Daftar Hadir ({checkedIn.length})
          </h2>
        </div>

        {checkedIn.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <UserCheck className="mx-auto size-12 mb-4 text-muted-foreground" />
            <p>Belum ada peserta yang check-in.</p>
            <p className="mt-1">Scan QR tiket untuk mencatat kehadiran.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 text-sm">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">No</th>
                  <th className="px-4 py-3 text-left font-medium">Nama</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">WhatsApp</th>
                  <th className="px-4 py-3 text-left font-medium">Waktu Check-in</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {checkedIn.map((record, index) => (
                  <tr key={record.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{record.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{record.email}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {record.whatsapp}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {record.checked_in_at
                        ? formatDateID(record.checked_in_at)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Not Checked In */}
      {notCheckedIn.length > 0 && (
        <div className="surface-card mt-6">
          <div className="border-b border-border p-4">
            <h2 className="font-display text-xl font-bold">
              Belum Check-in ({notCheckedIn.length})
            </h2>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {notCheckedIn.map((record) => (
                <span
                  key={record.id}
                  className="inline-block rounded-full bg-muted px-3 py-1 text-xs"
                >
                  {record.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
