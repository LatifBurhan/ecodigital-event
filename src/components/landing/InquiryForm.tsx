import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES, normalizeWhatsapp } from "@/lib/eco";

const schema = z.object({
  organizer_name: z.string().trim().min(2, "Nama penyelenggara wajib diisi").max(120),
  institution: z.string().trim().min(2, "Institusi / instansi wajib diisi").max(160),
  event_type: z.enum(EVENT_TYPES, { errorMap: () => ({ message: "Pilih tipe acara" }) }),
  duration_days: z.coerce
    .number({ invalid_type_error: "Durasi wajib diisi" })
    .int("Durasi harus bilangan bulat")
    .min(1, "Durasi minimal 1 hari")
    .max(365, "Durasi maksimal 365 hari"),
  estimated_participants: z
    .union([z.coerce.number().int().positive("Jumlah peserta harus lebih dari 0").max(100000), z.nan()])
    .optional(),
  email: z.string().trim().email("Format email tidak valid").max(200),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Nomor WhatsApp wajib diisi")
    .refine((v) => /^[0-9]{8,18}$/.test(normalizeWhatsapp(v)), "Format nomor WhatsApp tidak valid"),
  notes: z.string().trim().max(2000).optional(),
});

type FormValues = z.input<typeof schema>;

const COOLDOWN_KEY = "eco_inquiry_last_submit";
const COOLDOWN_MS = 45_000;

export function InquiryForm() {
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { event_type: "Conference", duration_days: 1 },
  });

  const onSubmit = handleSubmit(async (raw) => {
    const values = schema.parse(raw);

    const last = Number(window.localStorage.getItem(COOLDOWN_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) {
      toast.error("Mohon tunggu sebentar sebelum mengirim formulir lagi.");
      return;
    }

    const participants =
      typeof values.estimated_participants === "number" &&
      Number.isFinite(values.estimated_participants)
        ? values.estimated_participants
        : null;

    const { error } = await supabase.from("partner_inquiries").insert({
      organizer_name: values.organizer_name,
      institution: values.institution,
      event_type: values.event_type,
      duration_days: values.duration_days,
      estimated_participants: participants,
      email: values.email,
      whatsapp: normalizeWhatsapp(values.whatsapp),
      notes: values.notes?.length ? values.notes : null,
      status: "Baru",
    });

    if (error) {
      toast.error("Pengiriman gagal", {
        description: "Terjadi kesalahan saat menyimpan data. Silakan coba lagi.",
      });
      return;
    }

    window.localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    reset({ event_type: "Conference", duration_days: 1 });
    setSuccess(true);
    toast.success("Terima kasih!", {
      description: "Minat kemitraan Anda berhasil dikirim. Tim kami akan menghubungi Anda.",
    });
  });

  return (
    <section id="contact" className="bg-forest-deep text-forest-foreground">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-28">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.2em] text-mint uppercase">
            04 / Join the pilot
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight font-bold sm:text-4xl">
            Bawa event Anda <span className="text-mint">ke arah yang baru.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-forest-foreground/75">
            Ceritakan kebutuhan event Anda. Kami akan menghubungkan Anda dengan konsep ECO-DIGITAL
            EVENT KIT dan proyeksi green impact awalnya.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Konsultasi konsep pilot project",
              "Proyeksi green impact awal",
              "Feedback untuk pengembangan prototipe",
            ].map((i) => (
              <li key={i} className="flex items-center gap-2 text-forest-foreground/85">
                <CheckCircle2 className="size-4 text-mint" /> {i}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-card p-6 text-card-foreground shadow-[var(--shadow-lift)] sm:p-9">
          <p className="eyebrow">Form Minat Mitra</p>
          <h3 className="mt-2 font-display text-2xl font-bold">Mulai percakapan.</h3>

          {success && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-primary/25 bg-soft p-4 text-sm text-forest">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              Terima kasih! Minat kemitraan Anda berhasil dikirim. Tim kami akan menghubungi Anda.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
            <Field label="Nama penyelenggara" htmlFor="organizer_name" error={errors.organizer_name?.message}>
              <Input id="organizer_name" placeholder="Contoh: Naya Pratama" {...register("organizer_name")} />
            </Field>

            <Field label="Institusi / instansi" htmlFor="institution" error={errors.institution?.message}>
              <Input id="institution" placeholder="Contoh: Universitas Hijau" {...register("institution")} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tipe acara" htmlFor="event_type" error={errors.event_type?.message}>
                <select
                  id="event_type"
                  {...register("event_type")}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Durasi (hari)" htmlFor="duration_days" error={errors.duration_days?.message}>
                <Input id="duration_days" type="number" min={1} {...register("duration_days")} />
              </Field>
            </div>

            <Field
              label="Estimasi jumlah peserta (opsional)"
              htmlFor="estimated_participants"
              error={errors.estimated_participants?.message as string | undefined}
            >
              <Input
                id="estimated_participants"
                type="number"
                min={1}
                placeholder="Contoh: 500"
                {...register("estimated_participants")}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input id="email" type="email" placeholder="nama@email.com" {...register("email")} />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp?.message}>
                <Input id="whatsapp" inputMode="tel" placeholder="08xx-xxxx-xxxx" {...register("whatsapp")} />
              </Field>
            </div>

            <Field label="Catatan kebutuhan (opsional)" htmlFor="notes" error={errors.notes?.message}>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Ceritakan sedikit tentang event yang sedang disiapkan..."
                {...register("notes")}
              />
            </Field>

            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? "Mengirim..." : "Kirim minat saya"} <Send className="size-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Data hanya digunakan untuk kebutuhan konsultasi pilot project.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
