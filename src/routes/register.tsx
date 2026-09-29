import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Daftar Akun — ECO-DIGITAL EVENT KIT" },
      { name: "description", content: "Buat akun baru untuk mendaftar event." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const search = Route.useSearch<{ redirect?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Nama minimal 2 karakter.");
    if (whatsapp.replace(/\D/g, "").length < 9) return toast.error("Nomor WhatsApp tidak valid.");
    if (password.length < 6) return toast.error("Password minimal 6 karakter.");

    setLoading(true);

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            whatsapp: whatsapp.trim(),
          },
        },
      });

      if (error) {
        console.error("[Register] Supabase signup error:", error);
        throw new Error(error.message);
      }

      // Buat profil langsung dari aplikasi dengan retry mechanism
      if (signUpData.user) {
        const normalizedWa = whatsapp.trim().replace(/\D/g, "");
        const waNumber = normalizedWa.startsWith("0")
          ? "62" + normalizedWa.slice(1)
          : normalizedWa.startsWith("8")
            ? "62" + normalizedWa
            : normalizedWa;

        // Tunggu sebentar untuk memberi waktu trigger database berjalan
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Cek apakah profil sudah ada (dari trigger)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", signUpData.user.id)
          .maybeSingle();

        if (!existingProfile) {
          console.log("[Register] Profil belum ada, membuat profil manual...");
          
          // Retry sampai 5 kali dengan delay exponential backoff
          let profileCreated = false;
          for (let attempt = 1; attempt <= 5; attempt++) {
            const { error: profileError } = await supabase.from("profiles").insert({
              id: signUpData.user.id,
              full_name: name.trim().slice(0, 120),
              email: email.trim().toLowerCase(),
              whatsapp: waNumber,
            });

            if (!profileError) {
              console.log(`[Register] Profil berhasil dibuat pada percobaan ke-${attempt}`);
              profileCreated = true;
              break;
            }

            // Jika error duplicate, berarti profil sudah ada (race condition)
            if (profileError.message.includes("duplicate") || profileError.message.includes("already exists")) {
              console.log(`[Register] Profil sudah ada (race condition resolved)`);
              profileCreated = true;
              break;
            }

            console.error(`[Register] Percobaan ke-${attempt} gagal:`, profileError);
            
            // Exponential backoff: 500ms, 1s, 2s, 4s
            if (attempt < 5) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
            }
          }

          if (!profileCreated) {
            // Cek lagi apakah profil sudah ada
            const { data: recheckProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", signUpData.user.id)
              .maybeSingle();
            
            if (!recheckProfile) {
              console.error("[Register] Gagal membuat profil setelah 5 percobaan");
              throw new Error("Gagal membuat profil. Silakan coba lagi atau hubungi admin.");
            }
          }
        } else {
          console.log("[Register] Profil sudah ada (dari trigger)");
        }
      }

      toast.success("Berhasil mendaftar! Anda sudah masuk.");
      navigate({ to: search.redirect || "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-deep px-5 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-[var(--shadow-lift)] sm:p-10">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-bold">Buat Akun</h1>
        <p className="mt-2 text-sm text-muted-foreground">Daftar untuk mengikuti event.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap (untuk Sertifikat)</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sesuai identitas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">Nomor WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full rounded-xl" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {loading ? "Mendaftar..." : "Daftar Akun"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link
            to="/login"
            search={{ redirect: search.redirect }}
            className="text-primary hover:underline font-medium"
          >
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
