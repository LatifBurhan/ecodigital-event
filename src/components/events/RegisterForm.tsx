import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asPayments, rupiah } from "@/lib/events";
import type { PublicEvent } from "@/lib/events.functions";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"name" | "email" | "whatsapp" | "method" | "proof", string>>;

export function RegisterForm({ event }: { event: PublicEvent }) {
  const navigate = useNavigate();
  const methods = asPayments(event.payment_methods);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Nama minimal 2 karakter.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Format email tidak valid.";
    if (whatsapp.replace(/\D/g, "").length < 9) e.whatsapp = "Nomor WhatsApp tidak valid.";
    if (event.is_paid) {
      if (!method) e.method = "Pilih metode pembayaran.";
      if (!proof) e.proof = "Unggah bukti pembayaran.";
      else if (proof.size > 5 * 1024 * 1024) e.proof = "Ukuran file maksimal 5 MB.";
      else if (!/^(image\/|application\/pdf)/.test(proof.type)) e.proof = "File harus gambar atau PDF.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (loading || !validate()) return;
    setLoading(true);
    try {
      let proofPath: string | null = null;
      if (event.is_paid && proof) {
        const ext = proof.name.split(".").pop()?.toLowerCase() || "jpg";
        proofPath = `${event.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("payment-proofs")
          .upload(proofPath, proof, { contentType: proof.type });
        if (error) throw new Error("Gagal mengunggah bukti pembayaran.");
      }
      const { data, error } = await supabase.rpc("register_for_event", {
        _event_id: event.id,
        _name: name,
        _email: email,
        _whatsapp: whatsapp,
        _payment_method: event.is_paid ? method : undefined,
        _proof_path: proofPath ?? undefined,
      });
      if (error || !data) throw new Error(error?.message ?? "Pendaftaran gagal.");
      try {
        const saved = JSON.parse(localStorage.getItem("eco_tickets") ?? "[]") as string[];
        localStorage.setItem("eco_tickets", JSON.stringify([data, ...saved].slice(0, 20)));
      } catch {
        /* abaikan */
      }
      toast.success("Pendaftaran berhasil!");
      navigate({ to: "/tiket/$code", params: { code: data } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pendaftaran gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nama lengkap" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Nomor WhatsApp" error={errors.whatsapp}>
        <Input
          inputMode="tel"
          placeholder="08xxxxxxxxxx"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          maxLength={20}
        />
      </Field>

      {event.is_paid && (
        <div className="space-y-4 rounded-2xl border border-border bg-soft/60 p-4">
          <p className="text-sm">
            Biaya pendaftaran: <strong className="text-primary">{rupiah(event.price)}</strong>
          </p>
          <div>
            <Label className="mb-2 block">Transfer ke salah satu rekening</Label>
            <div className="space-y-2">
              {methods.map((m) => {
                const key = `${m.name} - ${m.account_number}`;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setMethod(key)}
                    className={cn(
                      "w-full rounded-xl border bg-card p-3 text-left text-sm transition-colors",
                      method === key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="block font-semibold">{m.name}</span>
                    <span className="font-mono">{m.account_number}</span>
                    <span className="block text-xs text-muted-foreground">a.n. {m.account_name}</span>
                  </button>
                );
              })}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">Info rekening belum tersedia.</p>
              )}
            </div>
            {errors.method && <p className="mt-1 text-xs text-destructive">{errors.method}</p>}
          </div>
          <Field label="Bukti pembayaran (gambar/PDF, maks 5 MB)" error={errors.proof}>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:border-primary">
              <Upload className="size-4" />
              <span className="truncate">{proof ? proof.name : "Pilih file"}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              />
            </label>
          </Field>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {loading ? "Mengirim..." : "Daftar sekarang"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {event.is_paid
          ? "Tiket QR aktif setelah admin memverifikasi pembayaran Anda."
          : "Tiket QR langsung muncul setelah mendaftar."}
      </p>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
