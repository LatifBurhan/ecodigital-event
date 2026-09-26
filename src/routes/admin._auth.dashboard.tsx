import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, Inbox, Loader2, Users } from "lucide-react";

import { inquiriesQuery } from "@/lib/inquiries";
import { EVENT_TYPES, STATUSES, STATUS_STYLES, nf, type InquiryStatus } from "@/lib/eco";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_auth/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Admin — ECO-DIGITAL EVENT KIT" }] }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

function Dashboard() {
  const { data, isLoading, isError } = useQuery(inquiriesQuery);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat data...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="surface-card p-8 text-sm text-destructive">
        Gagal memuat data. Silakan muat ulang halaman.
      </div>
    );
  }

  const total = data.length;
  const participantRows = data.filter((r) => r.estimated_participants != null);
  const totalParticipants = participantRows.reduce(
    (sum, r) => sum + (r.estimated_participants ?? 0),
    0,
  );
  const totalDays = data.reduce((sum, r) => sum + r.duration_days, 0);

  const byType = EVENT_TYPES.map((t) => ({
    name: t,
    value: data.filter((r) => r.event_type === t).length,
  })).filter((d) => d.value > 0);

  const byStatus = STATUSES.map((s) => ({
    name: s,
    value: data.filter((r) => r.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={Inbox} label="Total Pengisian Form" value={nf.format(total)} hint="pengajuan tersimpan" />
        <Metric
          icon={Users}
          label="Total Estimasi Peserta"
          value={participantRows.length ? nf.format(totalParticipants) : "Belum tersedia"}
          hint={
            participantRows.length
              ? `dari ${participantRows.length} pengajuan yang mencantumkan peserta`
              : "jumlah peserta belum dikumpulkan pada pengajuan yang masuk"
          }
        />
        <Metric
          icon={CalendarClock}
          label="Total Durasi Acara"
          value={nf.format(totalDays)}
          hint="hari dari seluruh pengajuan"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Breakdown Tipe Acara</h2>
          {byType.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {byType.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {d.name} · {d.value}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-base font-semibold">Status Breakdown</h2>
          {total === 0 ? (
            <EmptyChart />
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {byStatus.map((s) => (
              <span
                key={s.name}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  STATUS_STYLES[s.name as InquiryStatus],
                )}
              >
                {s.name} · {s.value}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-soft text-primary">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="mt-10 pb-10 text-center text-sm text-muted-foreground">
      Belum ada data pendaftar yang masuk.
    </p>
  );
}
