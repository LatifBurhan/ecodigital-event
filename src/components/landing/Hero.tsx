import { ArrowRight, BadgeCheck, Leaf, QrCode, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-conference.jpg";
import { calcImpact, nf, nf1 } from "@/lib/eco";

const highlights = [
  { icon: Leaf, label: "Paperless Event Management" },
  { icon: QrCode, label: "Smart Registration" },
  { icon: BadgeCheck, label: "Measurable Green Impact" },
];

export function Hero() {
  const preview = calcImpact(500, 4);

  return (
    <section id="beranda" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--gradient-glow)" }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-lime/50 bg-lime/20 px-4 py-2 font-mono text-[0.68rem] tracking-[0.18em] text-forest uppercase">
            <Sparkles className="size-3.5" /> Inovasi konsep Green MICE
          </span>

          <h1 className="mt-6 font-display text-4xl leading-[1.05] font-bold text-foreground sm:text-5xl lg:text-6xl">
            ECO-DIGITAL EVENT KIT: Inovasi Digitalisasi{" "}
            <span className="underline-lime text-primary">Conference</span> untuk Green MICE
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Solusi terintegrasi untuk efisiensi administrasi event dan pengurangan limbah kertas
            yang terukur.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full">
              <a href="#contact">
                Konsultasi Pilot Project <Send className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-card">
              <a href="#features">
                Lihat Fitur <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6">
            {highlights.map((h) => (
              <li key={h.label} className="flex items-center gap-2 text-sm text-foreground/80">
                <h.icon className="size-4 text-primary" />
                {h.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="forest-panel relative overflow-hidden p-7 sm:p-9">
          <img
            src={heroImage}
            alt="Suasana conference modern dengan layar panggung digital"
            width={1200}
            height={912}
            className="absolute inset-0 size-full object-cover opacity-25"
          />
          <div className="relative">
            <p className="font-mono text-[0.68rem] tracking-[0.2em] text-mint uppercase">
              Green Impact / Live Preview
            </p>
            <p className="mt-8 text-sm text-forest-foreground/80">
              Dengan 500 peserta &amp; 4 dokumen per peserta, event Anda berpotensi menghindari
            </p>
            <p className="mt-2 font-display text-5xl font-bold text-forest-foreground sm:text-6xl">
              {nf.format(preview.sheets)}
              <span className="ml-2 text-2xl font-semibold text-lime">lembar</span>
            </p>
            <p className="mt-1 text-sm text-forest-foreground/70">material cetak</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-forest-foreground/15 bg-forest-deep/50 p-5">
                <p className="font-mono text-[0.62rem] tracking-[0.18em] text-mint uppercase">
                  CO₂e reduksi
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-forest-foreground">
                  {nf1.format(preview.co2Kg)} <span className="text-base">kg</span>
                </p>
              </div>
              <div className="rounded-2xl border border-forest-foreground/15 bg-forest-deep/50 p-5">
                <p className="font-mono text-[0.62rem] tracking-[0.18em] text-mint uppercase">
                  Kertas dihemat
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-forest-foreground">
                  {nf1.format(preview.paperKg)} <span className="text-base">kg</span>
                </p>
              </div>
            </div>
            <p className="mt-5 text-xs text-forest-foreground/60">
              Angka simulasi ilustratif, bukan hasil audit lingkungan.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
