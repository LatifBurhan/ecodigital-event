import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/landing/SiteNav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Calculator } from "@/components/landing/Calculator";
import { About } from "@/components/landing/About";
import { InquiryForm } from "@/components/landing/InquiryForm";
import { SiteFooter } from "@/components/landing/SiteFooter";

const title = "ECO-DIGITAL EVENT KIT — Digitalisasi Conference untuk Green MICE";
const description =
  "Platform digital untuk conference dan seminar berbasis Green MICE: e-invitation, QR check-in, digital event guide, e-certificate, dan kalkulator green impact.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main>
        <Hero />
        <Features />
        <Calculator />
        <About />
        <InquiryForm />
      </main>
      <SiteFooter />
    </div>
  );
}
