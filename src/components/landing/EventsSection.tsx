import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarX } from "lucide-react";
import { publicEventsQuery } from "@/lib/events.functions";
import { isEventOver } from "@/lib/events";
import { EventCard } from "@/components/events/EventCard";

export function EventsSection() {
  const { data } = useSuspenseQuery(publicEventsQuery);
  const upcoming = data.filter((e) => !isEventOver(e));
  const past = data.filter((e) => isEventOver(e)).reverse();

  return (
    <section id="events" className="scroll-mt-24 bg-surface py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="eyebrow">Agenda</p>
        <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Event yang akan datang</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pilih event, lihat detailnya, lalu daftar langsung — tiket QR dikirim secara digital, tanpa
          kertas.
        </p>

        {upcoming.length === 0 ? (
          <div className="surface-card mt-10 flex flex-col items-center gap-3 p-12 text-center">
            <CalendarX className="size-8 text-primary" />
            <p className="font-medium">Belum ada event yang dibuka.</p>
            <p className="text-sm text-muted-foreground">Nantikan event berikutnya di sini.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h3 className="mt-16 font-display text-xl font-bold">Event sebelumnya</h3>
            <div className="mt-6 grid gap-6 opacity-80 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {past.slice(0, 4).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
