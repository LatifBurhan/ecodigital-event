import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CertificateUpload } from "@/components/admin/CertificateUpload";
import {
  SOCIAL_PLATFORMS,
  asPayments,
  asSocials,
  slugify,
  uploadPoster,
  type EventRow,
  type PaymentMethod,
  type SocialLink,
} from "@/lib/events";

type ErrKey =
  | "title"
  | "startDate"
  | "endDate"
  | "location"
  | "mapsUrl"
  | "organizer"
  | "poster"
  | "price"
  | "payments";

export function EventForm({ initial }: { initial?: EventRow }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [mapsUrl, setMapsUrl] = useState(initial?.maps_url ?? "");
  const [organizer, setOrganizer] = useState(initial?.organizer ?? "");
  const [posterUrl, setPosterUrl] = useState(initial?.poster_url ?? "");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateUrl, setCertificateUrl] = useState<string>("");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lineup, setLineup] = useState<string[]>(initial?.lineup ?? []);
  const [facilities, setFacilities] = useState<string[]>(initial?.facilities ?? []);
  const [socials, setSocials] = useState<SocialLink[]>(asSocials(initial?.socials));
  const [isPaid, setIsPaid] = useState(initial?.is_paid ?? false);
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [payments, setPayments] = useState<PaymentMethod[]>(asPayments(initial?.payment_methods));
  const [published, setPublished] = useState(initial?.is_published ?? true);
  const [regOpen, setRegOpen] = useState(initial?.registration_open ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ErrKey, string>>>({});

  const preview = posterFile ? URL.createObjectURL(posterFile) : posterUrl;

  // Fetch existing certificate template when editing
  useEffect(() => {
    if (initial?.id) {
      supabase
        .from("certificate_templates")
        .select("template_url")
        .eq("event_id", initial.id)
        .single()
        .then(({ data }) => {
          if (data?.template_url) {
            setCertificateUrl(data.template_url);
          }
        })
        .catch((err) => {
          console.log("[EventForm] No existing template found:", err);
        });
    }
  }, [initial?.id]);

  // Upload certificate template to storage
  async function uploadCertificate(file: File, eventId: string): Promise<string> {
    const ext = file.name.split(".").pop();
    const filename = `certificate-template-${eventId}.${ext}`;
    const filepath = `certificate-templates/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("certificate-templates")
      .upload(filepath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("certificate-templates").getPublicUrl(filepath);
    return data.publicUrl;
  }

  function validate() {
    const e: Partial<Record<ErrKey, string>> = {};
    if (title.trim().length < 3) e.title = "Nama event wajib diisi.";
    if (!startDate) e.startDate = "Tanggal mulai wajib diisi.";
    if (!endDate) e.endDate = "Tanggal selesai wajib diisi.";
    if (startDate && endDate && endDate < startDate)
      e.endDate = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    if (!location.trim()) e.location = "Lokasi wajib diisi.";
    if (!/^https?:\/\//.test(mapsUrl.trim()))
      e.mapsUrl = "Link Maps harus diawali http:// atau https://";
    if (!organizer.trim()) e.organizer = "Penyelenggara wajib diisi.";
    if (!posterFile && !posterUrl) e.poster = "Poster wajib diunggah.";
    if (posterFile && posterFile.size > 5 * 1024 * 1024) e.poster = "Ukuran poster maksimal 5 MB.";
    if (isPaid) {
      if (!(Number(price) > 0)) e.price = "Harga harus lebih dari 0.";
      const valid = payments.filter((p) => p.name.trim() && p.account_number.trim());
      if (valid.length === 0) e.payments = "Tambahkan minimal satu metode pembayaran.";
    }
    setErrors(e);
    if (Object.keys(e).length) toast.error("Periksa kembali isian yang wajib.");
    return Object.keys(e).length === 0;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const poster = posterFile ? await uploadPoster(posterFile) : posterUrl;
      const payload = {
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        location: location.trim(),
        maps_url: mapsUrl.trim(),
        organizer: organizer.trim(),
        poster_url: poster,
        description: description.trim() || null,
        lineup: lineup.map((s) => s.trim()).filter(Boolean),
        facilities: facilities.map((s) => s.trim()).filter(Boolean),
        socials: socials
          .filter((s) => s.url.trim())
          .map((s) => ({ platform: s.platform, url: s.url.trim() })),
        is_paid: isPaid,
        price: isPaid ? Math.round(Number(price)) : 0,
        payment_methods: isPaid
          ? payments
              .filter((p) => p.name.trim() && p.account_number.trim())
              .map((p) => ({
                name: p.name.trim(),
                account_number: p.account_number.trim(),
                account_name: p.account_name.trim(),
              }))
          : [],
        is_published: published,
        registration_open: regOpen,
      };

      let eventId: string;

      if (initial) {
        const { error } = await supabase.from("events").update(payload).eq("id", initial.id);
        if (error) throw error;
        eventId = initial.id;
      } else {
        const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
        const { data, error } = await supabase
          .from("events")
          .insert({ ...payload, slug })
          .select("id")
          .single();
        if (error) throw error;
        eventId = data.id;
      }

      // Handle certificate template upload
      if (certificateFile) {
        const certificateTemplateUrl = await uploadCertificate(certificateFile, eventId);

        // Check if certificate template already exists for this event
        const { data: existingTemplate } = await supabase
          .from("certificate_templates")
          .select("id")
          .eq("event_id", eventId)
          .single();

        if (existingTemplate) {
          // Update existing template
          const { error: templateError } = await supabase
            .from("certificate_templates")
            .update({
              template_url: certificateTemplateUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingTemplate.id);

          if (templateError) throw templateError;
        } else {
          // Insert new template
          const { error: templateError } = await supabase
            .from("certificate_templates")
            .insert({
              event_id: eventId,
              template_url: certificateTemplateUrl,
            });

          if (templateError) throw templateError;
        }

        toast.success("Template sertifikat berhasil diunggah.");
      }

      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["public"] });
      toast.success(initial ? "Event diperbarui." : "Event berhasil dibuat.");
      navigate({ to: "/admin/events" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EventForm] Gagal menyimpan:", err);
      toast.error(`Gagal menyimpan event: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <Section title="Informasi utama" hint="Wajib diisi">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div>
            <Label className="mb-1.5 block">Poster event *</Label>
            <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-soft text-sm text-muted-foreground hover:border-primary">
              {preview ? (
                <img src={preview} alt="Pratinjau poster" className="size-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="size-8" /> Unggah poster
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {preview && (
              <p className="mt-1 text-xs text-muted-foreground">Klik gambar untuk mengganti.</p>
            )}
            <Err msg={errors.poster} />
          </div>
          <div className="space-y-4">
            <F label="Nama event *" err={errors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
            </F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Tanggal mulai *" err={errors.startDate}>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate) setEndDate(e.target.value);
                  }}
                />
              </F>
              <F label="Tanggal selesai *" err={errors.endDate}>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </F>
            </div>
            <F label="Lokasi *" err={errors.location}>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Gedung Serbaguna Kampus, Yogyakarta"
              />
            </F>
            <F label="Link Google Maps *" err={errors.mapsUrl}>
              <Input
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
            </F>
            <F label="Dibuat oleh *" err={errors.organizer}>
              <Input
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="BEM Universitas Yogyakarta"
              />
            </F>
          </div>
        </div>
      </Section>

      <Section
        title="Detail tambahan"
        hint="Opsional — yang kosong tidak ditampilkan di halaman event"
      >
        <F label="Deskripsi">
          <Textarea rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
        </F>
        <ListInput
          label="Line up"
          placeholder="Nama band / pembicara"
          items={lineup}
          setItems={setLineup}
        />
        <ListInput
          label="Fasilitas"
          placeholder="Contoh: Sertifikat, Snack"
          items={facilities}
          setItems={setFacilities}
        />
        <div>
          <Label className="mb-2 block">Media sosial</Label>
          <div className="space-y-2">
            {socials.map((s, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={s.platform}
                  onChange={(e) =>
                    setSocials(
                      socials.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)),
                    )
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <Input
                  value={s.url}
                  placeholder="https://..."
                  onChange={(e) =>
                    setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                  }
                />
                <RemoveBtn onClick={() => setSocials(socials.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
          <AddBtn onClick={() => setSocials([...socials, { platform: "Instagram", url: "" }])}>
            Tambah media sosial
          </AddBtn>
        </div>
      </Section>

      <Section title="Template Sertifikat" hint="Opsional — upload template untuk generate sertifikat otomatis">
        <CertificateUpload
          file={certificateFile}
          currentUrl={certificateUrl}
          onFileChange={setCertificateFile}
        />
      </Section>

      <Section title="Tiket & pembayaran">
        <Toggle
          label="Event berbayar"
          desc="Pendaftar wajib mengunggah bukti transfer dan disetujui admin."
          checked={isPaid}
          onChange={setIsPaid}
        />
        {isPaid && (
          <div className="space-y-4">
            <F label="Harga tiket (Rp) *" err={errors.price}>
              <Input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="max-w-xs"
              />
            </F>
            <div>
              <Label className="mb-2 block">Metode pembayaran *</Label>
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    {(["name", "account_number", "account_name"] as const).map((k) => (
                      <Input
                        key={k}
                        value={p[k]}
                        placeholder={
                          k === "name"
                            ? "Bank / e-wallet (BCA, DANA)"
                            : k === "account_number"
                              ? "No. rekening / HP"
                              : "Atas nama"
                        }
                        onChange={(e) =>
                          setPayments(
                            payments.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                          )
                        }
                      />
                    ))}
                    <RemoveBtn onClick={() => setPayments(payments.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </div>
              <AddBtn
                onClick={() =>
                  setPayments([...payments, { name: "", account_number: "", account_name: "" }])
                }
              >
                Tambah metode pembayaran
              </AddBtn>
              <Err msg={errors.payments} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Pengaturan">
        <Toggle
          label="Tampilkan di halaman depan"
          desc="Matikan untuk menyimpan sebagai draf."
          checked={published}
          onChange={setPublished}
        />
        <Toggle
          label="Pendaftaran dibuka"
          desc="Matikan untuk menutup pendaftaran sementara."
          checked={regOpen}
          onChange={setRegOpen}
        />
      </Section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => navigate({ to: "/admin/events" })}
        >
          Batal
        </Button>
        <Button type="submit" className="rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Menyimpan..." : "Simpan event"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card space-y-5 p-6">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
function F({
  label,
  err,
  children,
}: {
  label: string;
  err?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      <Err msg={err} />
    </div>
  );
}
function Err({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}
function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="outline" size="sm" className="mt-2 rounded-xl" onClick={onClick}>
      <Plus className="size-4" /> {children}
    </Button>
  );
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} aria-label="Hapus">
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
function ListInput({
  label,
  placeholder,
  items,
  setItems,
}: {
  label: string;
  placeholder: string;
  items: string[];
  setItems: (v: string[]) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={v}
              placeholder={placeholder}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <RemoveBtn onClick={() => setItems(items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <AddBtn onClick={() => setItems([...items, ""])}>Tambah {label.toLowerCase()}</AddBtn>
    </div>
  );
}
