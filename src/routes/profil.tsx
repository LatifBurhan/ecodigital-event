import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, User, Mail, Phone, ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string;
    whatsapp: string;
  } | null>(null);

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { redirect: "/profil" } });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, whatsapp")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("[Profil] Error loading profile:", error);
          toast.error("Gagal memuat profil");
          return;
        }

        setProfile(data);
        setFullName(data.full_name || "");
        setWhatsapp(data.whatsapp || "");
      } catch (err) {
        console.error("[Profil] Error:", err);
        toast.error("Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    }

    if (user && !authLoading) {
      loadProfile();
    }
  }, [user, authLoading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;

    const trimmedName = fullName.trim();
    const trimmedWa = whatsapp.trim().replace(/\D/g, "");

    if (trimmedName.length < 2) {
      toast.error("Nama minimal 2 karakter");
      return;
    }
    if (trimmedWa.length < 9) {
      toast.error("Nomor WhatsApp tidak valid");
      return;
    }

    setSaving(true);

    try {
      // Normalize WhatsApp number
      const normalizedWa = trimmedWa.startsWith("0")
        ? "62" + trimmedWa.slice(1)
        : trimmedWa.startsWith("8")
          ? "62" + trimmedWa
          : trimmedWa;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName.slice(0, 120),
          whatsapp: normalizedWa,
        })
        .eq("id", user.id);

      if (error) {
        console.error("[Profil] Error updating profile:", error);
        throw new Error("Gagal menyimpan perubahan: " + error.message);
      }

      setProfile({
        full_name: trimmedName,
        whatsapp: normalizedWa,
      });

      toast.success("Profil berhasil diperbarui!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-4 rounded-full"
          >
            <Link to="/">
              <ArrowLeft className="size-4 mr-2" />
              Kembali
            </Link>
          </Button>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Profil Saya</h1>
              <p className="text-sm text-muted-foreground">
                Kelola informasi akun Anda
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="rounded-2xl p-6 shadow-lg">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                <Mail className="size-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Email tidak dapat diubah
              </p>
            </div>

            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="flex items-center gap-2 mb-2">
                <User className="size-4" />
                Nama Lengkap
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Masukkan nama lengkap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                disabled={saving}
              />
            </div>

            {/* WhatsApp */}
            <div>
              <Label htmlFor="whatsapp" className="flex items-center gap-2 mb-2">
                <Phone className="size-4" />
                Nomor WhatsApp
              </Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
                disabled={saving}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Format: 08xxxxxxxxxx atau 628xxxxxxxxxx
              </p>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Profile Info */}
        {profile && (
          <Card className="mt-6 rounded-2xl p-6 bg-primary/5 border-primary/20">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Informasi Akun
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-green-600 font-medium">✓ Aktif</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terdaftar:</span>
                <span>
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString("id-ID")
                    : "-"}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded-full"
          >
            <Link to="/tiket">
              Lihat Tiket Saya
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex-1 rounded-full"
          >
            <Link to="/sertifikat">
              Sertifikat Saya
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
