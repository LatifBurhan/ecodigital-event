import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, Clock, Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminEventsQuery, formatDateRange, isEventOver } from "@/lib/events";
import { nf } from "@/lib/eco";

export const Route = createFileRoute("/admin/_auth/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Admin — ECO-DIGITAL EVENT KIT" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, isError } = useQuery(adminEventsQuery);
  if (isLoading) return <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat data...</div>;
  if (isError || !data) return <div className="surface-card p-8 text-sm text-destructive">Gagal memuat data.</div>;

  const active = data.filter((e) => !isEventOver(e));
  const regs = data.flatMap((e) => e.event_registrations);
  const pending = regs.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CalendarDays} label="Total Event" value={data.length} />
        <Metric icon={CalendarCheck} label="Event Berjalan" value={active.length} />
        <Metric icon={Users} label="Total Pendaftar" value={regs.length} />
        <Metric icon={Clock} label="Menunggu Verifikasi" value={pending} />
      </div>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Event yang sedang berjalan</h2>
          <Button asChild size="sm" className="rounded-xl"><Link to="/admin/events/new"><Plus className="size-4" /> Buat event</Link></Button>
        </div>
        {active.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Belum ada event aktif.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {active.map((e) => {
              const p = e.event_registrations.filter((r) => r.status === "pending").length;
              return (
                <li key={e.id}>
                  <Link to="/admin/events/$id" params={{ id: e.id }} className="flex items-center gap-4 py-3 hover:text-primary">
                    <img src={e.poster_url} alt="" className="h-14 w-11 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateRange(e.start_date, e.end_date)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{e.event_registrations.length} pendaftar</p>
                      {p > 0 && <p className="text-xs text-forest">{p} menunggu verifikasi</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-soft text-primary"><Icon className="size-5" /></span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold">{nf.format(value)}</p>
    </div>
  );
}
