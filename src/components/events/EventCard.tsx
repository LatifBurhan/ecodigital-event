import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { formatDateRange, isEventOver, rupiah } from "@/lib/events";
import type { PublicEvent } from "@/lib/events.functions";

export function EventCard({ event }: { event: PublicEvent }) {
  const over = isEventOver(event);
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      className="group surface-card flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-soft">
        <img
          src={event.poster_url}
          alt={`Poster ${event.title}`}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-forest backdrop-blur">
          {event.is_paid ? rupiah(event.price) : "Gratis"}
        </span>
        {over && (
          <span className="absolute top-3 right-3 rounded-full bg-forest-deep/85 px-3 py-1 text-xs font-medium text-forest-foreground">
            Selesai
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-lg leading-snug font-bold group-hover:text-primary">
          {event.title}
        </h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
            {formatDateRange(event.start_date, event.end_date)}
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="line-clamp-1">{event.location}</span>
          </li>
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="line-clamp-1">{event.organizer}</span>
          </li>
        </ul>
      </div>
    </Link>
  );
}
