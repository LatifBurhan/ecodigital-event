import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2, Ticket as TicketIcon, LogIn, ExternalLink } from "lucide-react";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateRange } from "@/lib/events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tiket/")({
  head: () => ({
    meta: [
      { title: "Tiket Saya — ECO-DIGITAL EVENT KIT" },
      { name: "description", content: "Daftar semua tiket event Anda." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyTickets,
});

interface UserTicket {
  ticket_code: string;
  name: string;
  email: string;
  status: string;
  amount: number;
  created_at: string;
  event_title: string;
  event_slug: string;
  start_date: string;
  end_date: string;
  location: string;
  poster_url: string;
  is_paid: boolean;
}

function MyTickets() {
  const { user, loading: authLoading } = useAuth();

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async (): Promise<UserTicket[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          ticket_code,
          name,
          email,
          status,
          amount,
          created_at,
          events (
            title,
            slug,
            start_date,
            end_date,
            location,
            poster_url,
            is_paid
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MyTickets] Error:", error);
        throw error;
      }

      // Transform nested events data
      return (data || []).map((item: any) => ({
        ticket_code: item.ticket_code,
        name: item.name,
        email: item.email,
        status: item.status,
        amount: item.amount,
        created_at: item.created_at,
        event_title: item.events?.title || "Event",
        event_slug: item.events?.slug || "",
        start_date: item.events?.start_date || "",
        end_date: item.events?.end_date || "",
        location: item.events?.location || "",
        poster_url: item.events?.poster_url || "",
        is_paid: item.events?.is_paid || false,
      }));
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <main className="mx-auto max-w-4xl px-5 py-20 text-center">
          <TicketIcon className="mx-auto size-16 text-muted-foreground" />
          <h1 className="mt-6 font-display text-3xl font-bold">Tiket Saya</h1>
          <p className="mt-3 text-muted-foreground">
            Anda harus masuk terlebih dahulu untuk melihat tiket Anda.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/login" search={{ redirect: "/tiket" }}>
              <LogIn className="size-4 mr-2" /> Masuk
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Tiket Saya</h1>
          <p className="mt-2 text-muted-foreground">
            Daftar semua tiket event yang Anda daftarkan.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <TicketIcon className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-semibold">Belum ada tiket</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Anda belum mendaftar event apapun. Yuk, cek event yang tersedia!
            </p>
            <Button asChild className="mt-6 rounded-full">
              <a href="/#events">Lihat Event</a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <Link
                key={ticket.ticket_code}
                to="/tiket/$code"
                params={{ code: ticket.ticket_code }}
                className="surface-card group flex gap-4 p-4 transition-all hover:shadow-[var(--shadow-lift)]"
              >
                <img
                  src={ticket.poster_url}
                  alt={ticket.event_title}
                  className="size-24 shrink-0 rounded-xl object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
                        {ticket.event_title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4 shrink-0" />
                        <span className="truncate">
                          {formatDateRange(ticket.start_date, ticket.end_date)}
                        </span>
                      </div>
                    </div>

                    <ExternalLink className="size-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    {ticket.is_paid && (
                      <span className="rounded-full bg-lime/20 px-2 py-0.5 text-xs font-medium text-forest-deep">
                        Berbayar
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="rounded-full"
          >
            Refresh
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    approved: {
      label: "Disetujui",
      className: "bg-primary/20 text-primary",
    },
    pending: {
      label: "Menunggu",
      className: "bg-lime/20 text-forest",
    },
    rejected: {
      label: "Ditolak",
      className: "bg-destructive/20 text-destructive",
    },
  };

  const c = config[status as keyof typeof config] || config.pending;

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}
