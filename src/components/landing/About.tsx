import { Leaf, Layers, Users } from "lucide-react";

const values = [
  {
    icon: Layers,
    title: "Efisiensi Administrasi",
    desc: "Data peserta, kehadiran, dan sertifikat tertata dalam satu alur kerja panitia.",
  },
  {
    icon: Users,
    title: "Pengalaman Peserta Terintegrasi",
    desc: "Satu tautan untuk undangan, tiket, panduan acara, hingga umpan balik.",
  },
  {
    icon: Leaf,
    title: "Dukungan Green MICE",
    desc: "Estimasi material yang dihindari menjadi laporan dampak yang bisa dibaca.",
  },
];

export function About() {
  return (
    <section id="about" className="border-y border-border bg-soft">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:py-28">
        <div>
          <p className="eyebrow">03 / Tentang</p>
          <h2 className="mt-4 font-display text-3xl leading-tight font-bold sm:text-4xl">
            Bukan hanya digital. <span className="text-primary">Digital yang sadar dampak.</span>
          </h2>
          <p className="mt-5 text-muted-foreground">
            ECO-DIGITAL EVENT KIT membantu penyelenggara mengelola proses acara secara digital dan
            mengurangi ketergantungan pada dokumen cetak — mulai dari undangan, registrasi,
            check-in, panduan acara, hingga sertifikat dan evaluasi.
          </p>
          <blockquote className="mt-8 border-l-2 border-primary pl-5 font-display text-lg leading-relaxed text-foreground">
            “Integrasi digital event management dengan pengukuran dampak lingkungan dalam satu
            platform.”
          </blockquote>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {values.map((v) => (
            <div key={v.title} className="surface-card flex gap-4 p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-mint">
                <v.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
