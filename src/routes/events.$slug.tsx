import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, Globe, MapPin, Users } from "lucide-react";

import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { RegisterForm } from "@/components/events/RegisterForm";
import { publicEventQuery } from "@/lib/events.functions";
import { asSocials, formatDateRange, isEventOver, rupiah } from "@/lib/events";

export const Route = createFileRoute("/events/$slug")({
  loader: async ({ context, params }) => {
    const ev = await context.queryClient.ensureQueryData(publicEventQuery(params.slug));
    if (!ev) throw notFound();
    return { title: ev.title, organizer: ev.organizer, poster: ev.poster_url };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — ECO-DIGITAL EVENT KIT` : "Event — ECO-DIGITAL EVENT KIT";
    const description = loaderData
      ? `${loaderData.title} oleh ${loaderData.organizer}. Lihat detail dan daftar online.`
      : "Detail event.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.poster
          ? [
              { property: "og:image", content: loaderData.poster },
              { name: "twitter:image", content: loaderData.poster },
            ]
          : []),
      ],
    };
  },
  errorComponent: () => (
    <div className="p-10 text-center text-sm text-destructive">Gagal memuat event. Coba muat ulang.</div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="font-display text-2xl font-bold">Event tidak ditemukan</p>
      <Link to="/" className="text-primary underline">Kembali ke beranda</Link>
    </div>
  ),
  component: EventDetail,
});

function EventDetail() {
  const { slug } = Route.useParams();
  const { data: ev } = useSuspenseQuery(publicEventQuery(slug));
  if (!ev) return null;
  const socials = asSocials(ev.socials).filter((s) => s.url);
  const over = isEventOver(ev);
  const open = ev.registration_open && !over;

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Link to="/" hash="events" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Semua event
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-10">
            <div className="grid gap-8 md:grid-cols-[300px_1fr]">
              <img src={ev.poster_url} alt={`Poster ${ev.title}`} className="w-full rounded-3xl object-cover shadow-[var(--shadow-soft)]" />
              <div>
                <span className="inline-block rounded-full bg-lime/25 px-3 py-1 text-xs font-semibold text-forest-deep">
                  {ev.is_paid ? rupiah(ev.price) : "Gratis"}
                </span>
                <h1 className="mt-4 font-display text-3xl leading-tight font-bold sm:text-4xl">{ev.title}</h1>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex gap-3"><CalendarDays className="size-5 shrink-0 text-primary" />{formatDateRange(ev.start_date, ev.end_date)}</li>
                  <li className="flex gap-3">
                    <MapPin className="size-5 shrink-0 text-primary" />
                    <span>
                      {ev.location}
                      <a href={ev.maps_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary underline">
                        Buka Maps <ExternalLink className="size-3" />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3"><Users className="size-5 shrink-0 text-primary" />Diselenggarakan oleh {ev.organizer}</li>
                </ul>
                {socials.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {socials.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">
                        <Globe className="size-3.5" /> {s.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {ev.description && (
              <section>
                <h2 className="font-display text-xl font-bold">Deskripsi</h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground/85">{ev.description}</p>
              </section>
            )}

            {ev.lineup.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold">Line Up</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {ev.lineup.map((l) => (
                    <span key={l} className="inline-flex items-center rounded-2xl bg-forest px-4 py-2.5 text-sm font-semibold text-forest-foreground">
                      {l}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {ev.facilities.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold">Fasilitas</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {ev.facilities.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="surface-card p-6">
              <h2 className="font-display text-lg font-bold">Daftar Event</h2>
              <div className="mt-4">
                {open ? (
                  <RegisterForm event={ev} />
                ) : (
                  <p className="rounded-xl bg-soft p-4 text-sm text-muted-foreground">
                    {over ? "Event ini sudah selesai." : "Pendaftaran untuk event ini sedang ditutup."}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
