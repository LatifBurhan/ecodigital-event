import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/landing/SiteNav";
import { Hero } from "@/components/landing/Hero";
import { EventsSection } from "@/components/landing/EventsSection";
import { Features } from "@/components/landing/Features";
import { Calculator } from "@/components/landing/Calculator";
import { About } from "@/components/landing/About";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { publicEventsQuery } from "@/lib/events.functions";

const title = "ECO-DIGITAL EVENT KIT — Temukan & Daftar Event Green MICE";
const description =
  "Temukan event, conference, dan seminar terbaru. Daftar online, dapatkan tiket QR digital, dan dukung event tanpa kertas.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicEventsQuery),
  errorComponent: () => (
    <div className="p-10 text-center text-sm text-destructive">Gagal memuat halaman. Coba muat ulang.</div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Halaman tidak ditemukan.</div>,
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main>
        <Hero />
        <EventsSection />
        <Features />
        <Calculator />
        <About />
      </main>
      <SiteFooter />
    </div>
  );
}
