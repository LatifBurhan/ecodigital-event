import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateRange } from "@/lib/events";
import { formatDateID } from "@/lib/eco";

export const Route = createFileRoute("/admin/_auth/attendance/")({
  head: () => ({ 
    meta: [
      { title: "Daftar Hadir — Admin" }, 
      { name: "robots", content: "noindex" }
    ] 
  }),
  component: AttendanceList,
});

interface EventWithStats {
  id: string;
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  poster_url: string;
  total_registrations: number;
  checked_in_count: number;
}

function AttendanceList() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin", "attendance", "events"],
    queryFn: async (): Promise<EventWithStats[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          slug,
          title,
          start_date,
          end_date,
          location,
          poster_url,
          event_registrations (
            id,
            checked_in_at
          )
        `)
        .eq("is_published", true)
        .order("start_date", { ascending: false });

      if (error) throw error;

      return (data || []).map((event: any) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
        poster_url: event.poster_url,
        total_registrations: event.event_registrations?.length || 0,
        checked_in_count: event.event_registrations?.filter((r: any) => r.checked_in_at).length || 0,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Daftar Hadir</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih event untuk scan QR dan lihat daftar kehadiran.
        </p>
      </div>

      {!events || events.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <Users className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 font-semibold">Belum ada event</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Event yang sudah dipublikasi akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const attendanceRate =
              event.total_registrations > 0
                ? Math.round((event.checked_in_count / event.total_registrations) * 100)
                : 0;

            return (
              <Link
                key={event.id}
                to="/admin/attendance/$id"
                params={{ id: event.id }}
                className="surface-card group flex gap-4 p-4 transition-all hover:shadow-[var(--shadow-lift)]"
              >
                <img
                  src={event.poster_url}
                  alt={event.title}
                  className="size-24 shrink-0 rounded-xl object-cover"
                />

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
                    {event.title}
                  </h3>

                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 shrink-0" />
                      <span className="truncate">
                        {formatDateRange(event.start_date, event.end_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">
                        {event.checked_in_count}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}/ {event.total_registrations} hadir
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${attendanceRate}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground">{attendanceRate}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
