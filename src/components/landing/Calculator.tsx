import { useState } from "react";
import { CheckCircle2, TreePine } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSUMPTIONS, calcImpact, nf, nf1 } from "@/lib/eco";

function clamp(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function Calculator() {
  const [participants, setParticipants] = useState(500);
  const [docs, setDocs] = useState(4);
  const impact = calcImpact(participants, docs);

  return (
    <section id="green-impact" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-7 sm:p-10">
          <p className="eyebrow">02 / Eco-Simulator</p>
          <h2 className="mt-4 font-display text-3xl leading-tight font-bold sm:text-4xl">
            Lihat dampaknya sebelum event dimulai.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Sesuaikan skala event dan lihat estimasi material yang dapat dialihkan ke digital.
          </p>

          <div className="mt-10 space-y-9">
            <div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="participants" className="text-sm font-semibold">
                  Jumlah peserta
                </Label>
                <Input
                  id="participants"
                  type="number"
                  min={1}
                  max={20000}
                  value={participants}
                  onChange={(e) => setParticipants(clamp(Number(e.target.value), 1, 20000))}
                  className="h-10 w-28 rounded-xl text-right font-mono"
                />
              </div>
              <Slider
                className="mt-5"
                value={[Math.min(participants, 5000)]}
                min={50}
                max={5000}
                step={50}
                onValueChange={([v]) => setParticipants(v)}
                aria-label="Jumlah peserta"
              />
              <div className="mt-2 flex justify-between font-mono text-[0.68rem] text-muted-foreground">
                <span>50</span>
                <span>5.000</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="docs" className="text-sm font-semibold">
                  Dokumen cetak per peserta
                </Label>
                <Input
                  id="docs"
                  type="number"
                  min={1}
                  max={50}
                  value={docs}
                  onChange={(e) => setDocs(clamp(Number(e.target.value), 1, 50))}
                  className="h-10 w-28 rounded-xl text-right font-mono"
                />
              </div>
              <Slider
                className="mt-5"
                value={[Math.min(docs, 20)]}
                min={1}
                max={20}
                step={1}
                onValueChange={([v]) => setDocs(v)}
                aria-label="Dokumen cetak per peserta"
              />
              <div className="mt-2 flex justify-between font-mono text-[0.68rem] text-muted-foreground">
                <span>1 lembar</span>
                <span>20 lembar</span>
              </div>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-5 font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
            ASUMSI SIMULASI: 1 lembar = {ASSUMPTIONS.gramPerSheet} gram kertas ·{" "}
            {ASSUMPTIONS.co2GramPerSheet} gram CO₂e. Angka ilustratif untuk kebutuhan prototipe.
          </p>
        </div>

        <div className="forest-panel p-7 sm:p-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[0.68rem] tracking-[0.2em] text-mint uppercase">
                Projected green impact
              </p>
              <p className="mt-2 text-sm text-forest-foreground/75">
                {nf.format(participants)} peserta · {docs} dokumen / peserta
              </p>
            </div>
            <TreePine className="size-8 text-mint" />
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Stat label="Paper avoided" value={nf.format(impact.sheets)} unit="lembar" big />
            <Stat label="Berat kertas" value={nf1.format(impact.paperKg)} unit="kg estimasi" />
            <Stat label="CO₂e reduction" value={nf1.format(impact.co2Kg)} unit="kg estimasi" />
            <Stat
              label="Setara pohon"
              value={nf1.format(impact.sheets / 8333)}
              unit="pohon (ilustratif)"
            />
          </div>

          <p className="mt-9 flex items-start gap-2 border-t border-forest-foreground/15 pt-6 text-xs leading-relaxed text-forest-foreground/70">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" />
            Angka merupakan estimasi simulasi, bukan pengukuran dampak lingkungan aktual maupun
            hasil audit atau perhitungan siklus hidup terverifikasi.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  big,
}: {
  label: string;
  value: string;
  unit: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-forest-foreground/15 bg-forest-deep/45 p-5">
      <p className="font-mono text-[0.62rem] tracking-[0.18em] text-mint uppercase">{label}</p>
      <p
        className={
          big
            ? "mt-2 font-display text-4xl font-bold text-lime"
            : "mt-2 font-display text-3xl font-bold text-forest-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-forest-foreground/65">{unit}</p>
    </div>
  );
}
