import { Award, BarChart3, MailCheck, QrCode, BookOpen } from "lucide-react";

const features = [
  {
    no: "01",
    icon: MailCheck,
    title: "E-Invitation & E-Registration",
    desc: "Undangan dan pendaftaran digital yang mempermudah penyelenggara dan peserta tanpa proses administrasi berbasis kertas.",
  },
  {
    no: "02",
    icon: QrCode,
    title: "E-Ticket & QR Check-in System",
    desc: "Tiket digital dan pemindaian QR untuk proses registrasi peserta yang lebih cepat, praktis, dan terorganisir.",
  },
  {
    no: "03",
    icon: BookOpen,
    title: "Digital Event Guide",
    desc: "Panduan acara digital yang mencakup rundown, denah lokasi, FAQ, informasi pembicara, dan informasi penting lainnya.",
  },
  {
    no: "04",
    icon: Award,
    title: "E-Certificate & Feedback",
    desc: "Sertifikat elektronik dan formulir umpan balik untuk membantu proses pasca-acara secara lebih efisien.",
  },
  {
    no: "05",
    icon: BarChart3,
    title: "Green Impact Dashboard",
    desc: "Dashboard untuk memperkirakan jumlah dokumen cetak yang dihemat dan potensi pengurangan jejak karbon dari digitalisasi acara.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <p className="eyebrow">01 / The Kit</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
          Lima modul digital. <span className="text-primary">Satu pengalaman utuh.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Dari undangan pertama hingga laporan dampak, semua bekerja dalam satu ekosistem yang mudah
          dipahami panitia maupun peserta.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.no}
              className="surface-card group p-7 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground">
                  {f.no}
                </span>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-soft text-primary transition-colors group-hover:bg-forest group-hover:text-mint">
                  <f.icon className="size-5" />
                </span>
              </div>
              <h3 className="mt-6 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
