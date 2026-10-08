import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import { Loader2, Send, Upload, LogIn, Ticket, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { asPayments, rupiah } from "@/lib/events";
import type { PublicEvent } from "@/lib/events.functions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEnsureProfile } from "@/hooks/use-ensure-profile";
import { generateUUID } from "@/lib/eco";
import imageCompression from "browser-image-compression";

type Errors = Partial<Record<"method" | "proof", string>>;

export function RegisterForm({ event }: { event: PublicEvent }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  // Use the new hook to ensure profile exists (with error boundary)
  const { profileExists, isChecking: profileChecking } = useEnsureProfile(user);

  const methods = asPayments(event.payment_methods);
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const [existingTicket, setExistingTicket] = useState<string | null>(null);
  const [checkingTicket, setCheckingTicket] = useState(false);

  // Manual profile creation states (MUST be declared before any conditional returns)
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualWhatsapp, setManualWhatsapp] = useState("");

  // Handler untuk file selection dengan compression dan proper preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[RegisterForm] onChange triggered');
    
    const file = e.target.files?.[0];
    e.target.value = ''; // Reset input immediately
    
    if (!file) {
      console.log('[RegisterForm] No file selected');
      return;
    }

    console.log('[RegisterForm] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeKB: (file.size / 1024).toFixed(2) + ' KB',
      sizeMB: (file.size / 1024 / 1024).toFixed(2) + ' MB',
    });

    // Reset error
    setErrors((prev) => ({ ...prev, proof: undefined }));

    // Cleanup old preview
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch (err) {
        console.warn('[RegisterForm] Error revoking URL:', err);
      }
      setPreviewUrl(null);
    }

    try {
      setCompressing(true);

      // Check if it's an image by extension (more reliable than type on mobile)
      const fileName = file.name.toLowerCase();
      const isImage = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(fileName);
      const isPdf = fileName.endsWith('.pdf');

      if (!isImage && !isPdf) {
        throw new Error('Format file tidak didukung. Gunakan gambar atau PDF.');
      }

      // Validate size before processing
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal 10 MB');
      }

      let processedFile = file;
      let previewBlob = file;

      // Compress images (converts HEIC to JPEG automatically)
      if (isImage) {
        console.log('[RegisterForm] Compressing image...');
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: 'image/jpeg', // Convert everything to JPEG
          });

          console.log('[RegisterForm] Compression done:', {
            originalSize: (file.size / 1024).toFixed(2) + ' KB',
            compressedSize: (compressed.size / 1024).toFixed(2) + ' KB',
            reduction: (((file.size - compressed.size) / file.size) * 100).toFixed(1) + '%',
          });

          // Use compressed file for both preview and upload
          processedFile = new File([compressed], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg',
          });
          previewBlob = processedFile;
        } catch (compressionError) {
          console.error('[RegisterForm] Compression failed:', compressionError);
          // If compression fails, use original file
          toast.warning('Kompresi gambar gagal, menggunakan file asli');
        }
      }

      // Set processed file for upload
      setProof(processedFile);

      // Create preview using createObjectURL (fast, no memory issues)
      if (isImage) {
        try {
          const objectUrl = URL.createObjectURL(previewBlob);
          setPreviewUrl(objectUrl);
          console.log('[RegisterForm] Preview URL created');
        } catch (previewError) {
          console.error('[RegisterForm] Preview creation failed:', previewError);
          toast.warning('Preview gagal dibuat, tapi file tetap siap diupload');
        }
      } else {
        // PDF: no preview, just set null
        setPreviewUrl(null);
        console.log('[RegisterForm] PDF file, no preview');
      }

      toast.success(`File "${file.name}" siap diupload`);
    } catch (error) {
      console.error('[RegisterForm] File handling error:', error);
      const message = error instanceof Error ? error.message : 'Gagal memproses file';
      toast.error(message);
      setErrors((prev) => ({ ...prev, proof: message }));
      setProof(null);
      setPreviewUrl(null);
    } finally {
      setCompressing(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    // Only check for existing ticket after profile is confirmed to exist
    if (user && event.id && profileExists === true) {
      setCheckingTicket(true);

      // Cek apakah user sudah terdaftar berdasarkan user_id atau email
      supabase
        .from("event_registrations")
        .select("ticket_code")
        .eq("event_id", event.id)
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setExistingTicket(data.ticket_code);
          setCheckingTicket(false);
        })
        .catch((error) => {
          console.error("[RegisterForm] Error checking existing ticket:", error);
          setCheckingTicket(false);
        });
    }
  }, [user, event.id, profileExists]);

  // Jika belum login, tampilkan tombol login
  if (authLoading || profileChecking || checkingTicket) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-soft/60 p-6 text-center">
        <p className="text-sm text-foreground mb-4">
          Anda harus masuk terlebih dahulu untuk mendaftar event ini.
        </p>
        <Button asChild className="w-full rounded-full">
          <Link to="/login" search={{ redirect: location.href }}>
            <LogIn className="size-4 mr-2" /> Masuk atau Daftar
          </Link>
        </Button>
      </div>
    );
  }

  // Manual profile creation handler
  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || creatingProfile) return;

    const trimmedName = manualName.trim();
    const trimmedWa = manualWhatsapp.trim().replace(/\D/g, "");

    if (trimmedName.length < 2) {
      toast.error("Nama minimal 2 karakter");
      return;
    }
    if (trimmedWa.length < 9) {
      toast.error("Nomor WhatsApp tidak valid");
      return;
    }

    setCreatingProfile(true);

    try {
      const normalizedWa = trimmedWa.startsWith("0")
        ? "62" + trimmedWa.slice(1)
        : trimmedWa.startsWith("8")
          ? "62" + trimmedWa
          : trimmedWa;

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: trimmedName.slice(0, 120),
        email: (user.email || "").toLowerCase(),
        whatsapp: normalizedWa,
      });

      if (error) {
        // If duplicate key, profile already exists - treat as success
        if (error.message?.includes("duplicate") || error.code === "23505") {
          console.log("[RegisterForm] Profile already exists, reloading...");
          toast.success("Profil sudah ada!");
          window.location.reload();
          return;
        }
        
        console.error("[RegisterForm] Error creating profile:", error);
        throw new Error("Gagal membuat profil: " + error.message);
      }

      toast.success("Profil berhasil dibuat!");
      // Reload page to refresh profile state
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat profil");
      setCreatingProfile(false);
    }
  }

  if (profileExists === false) {
    return (
      <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
        <p className="text-sm font-medium text-destructive text-center mb-2">
          Profil Tidak Ditemukan
        </p>
        <p className="text-xs text-muted-foreground text-center mb-4">
          Lengkapi profil Anda untuk dapat mendaftar event.
        </p>

        <form onSubmit={handleCreateProfile} className="space-y-3">
          <div>
            <Label htmlFor="manual-name" className="text-xs">
              Nama Lengkap
            </Label>
            <Input
              id="manual-name"
              placeholder="Nama lengkap Anda"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
              disabled={creatingProfile}
            />
          </div>

          <div>
            <Label htmlFor="manual-whatsapp" className="text-xs">
              Nomor WhatsApp
            </Label>
            <Input
              id="manual-whatsapp"
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={manualWhatsapp}
              onChange={(e) => setManualWhatsapp(e.target.value)}
              required
              disabled={creatingProfile}
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={creatingProfile}
          >
            {creatingProfile ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Membuat Profil...
              </>
            ) : (
              "Lengkapi Profil"
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-3">
          Email Anda: <span className="font-medium">{user.email}</span>
        </p>
      </div>
    );
  }

  // Jika sudah punya tiket
  if (existingTicket) {
    return (
      <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary mb-2">
          <Ticket className="size-6" />
        </div>
        <p className="text-sm font-medium text-foreground">Anda sudah terdaftar di event ini!</p>
        <p className="text-xs text-muted-foreground mb-4">
          Email {user.email} telah digunakan untuk mendaftar.
        </p>
        <Button asChild className="w-full rounded-full">
          <Link to="/tiket/$code" params={{ code: existingTicket }}>
            Lihat Tiket Saya
          </Link>
        </Button>
      </div>
    );
  }

  function validate() {
    const e: Errors = {};
    if (event.is_paid) {
      if (!method) e.method = "Pilih metode pembayaran.";
      if (!proof) {
        e.proof = "Unggah bukti pembayaran.";
      } else {
        // Validasi ukuran saja (hapus validasi tipe file)
        if (proof.size > 10 * 1024 * 1024) {
          e.proof = "Ukuran file maksimal 10 MB.";
        }
        // Validasi tipe file di-relax untuk support berbagai format dari gallery HP
        const fileName = proof.name.toLowerCase();
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/);
        const isPdf = fileName.endsWith('.pdf');
        
        if (!isImage && !isPdf) {
          console.warn('[RegisterForm] Unusual file type:', { 
            name: proof.name, 
            type: proof.type, 
            size: proof.size 
          });
          // Tetap terima file, tapi beri warning
          toast.warning('Format file tidak standar, tapi akan dicoba upload');
        }
      }
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
        console.log('[RegisterForm] Uploading proof:', {
          name: proof.name,
          type: proof.type,
          size: proof.size,
        });
        
        // Deteksi ekstensi dari nama file
        let ext = proof.name.split(".").pop()?.toLowerCase() || "";
        
        // Jika tidak ada ekstensi atau tidak valid, gunakan default berdasarkan MIME type
        if (!ext || ext === proof.name.toLowerCase()) {
          if (proof.type.includes('image')) {
            ext = 'jpg'; // default untuk image
          } else if (proof.type.includes('pdf')) {
            ext = 'pdf';
          } else {
            ext = 'jpg'; // fallback
          }
        }
        
        proofPath = `${event.id}/${generateUUID()}.${ext}`;
        
        // Tentukan content type - lebih permisif
        let contentType = proof.type;
        if (!contentType || contentType === 'application/octet-stream' || contentType === '') {
          // Fallback berdasarkan ekstensi
          const mimeMap: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'heic': 'image/heic',
            'heif': 'image/heif',
            'bmp': 'image/bmp',
            'pdf': 'application/pdf',
          };
          contentType = mimeMap[ext] || 'application/octet-stream';
        }
        
        console.log('[RegisterForm] Upload config:', { proofPath, contentType, ext });
        
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(proofPath, proof, { 
            contentType,
            upsert: false 
          });
          
        if (uploadError) {
          console.error('[RegisterForm] Upload error:', uploadError);
          throw new Error(`Gagal mengunggah bukti pembayaran: ${uploadError.message}`);
        }
        
        console.log('[RegisterForm] Upload success:', proofPath);
      }

      const { data, error } = await supabase.rpc("register_for_event", {
        _event_id: event.id,
        _name: "", // Akan diabaikan oleh backend
        _email: user.email || "", // Akan diabaikan
        _whatsapp: "", // Akan diabaikan
        ...(event.is_paid ? { _payment_method: method } : {}),
        ...(proofPath ? { _proof_path: proofPath } : {}),
      });
      if (error || !data) {
        // Cek secara spesifik pesan errornya
        if (error?.message?.includes("sudah terdaftar")) {
          toast.info("Anda sudah terdaftar di event ini.");
          // Segarkan halaman untuk memuat tiket
          window.location.reload();
          return;
        }
        throw new Error(error?.message ?? "Pendaftaran gagal.");
      }
      try {
        const saved = JSON.parse(localStorage.getItem("eco_tickets") ?? "[]") as string[];
        localStorage.setItem("eco_tickets", JSON.stringify([data, ...saved].slice(0, 20)));
      } catch {
        /* abaikan */
      }
      
      // Cleanup preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
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
      <div className="rounded-2xl bg-muted/50 p-4 text-sm mb-4">
        <p className="text-muted-foreground mb-1">Mendaftar sebagai:</p>
        <p className="font-medium truncate">{user.email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Data pendaftaran akan menggunakan profil akun Anda.
        </p>
      </div>

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
                      method === key
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="block font-semibold">{m.name}</span>
                    <span className="font-mono">{m.account_number}</span>
                    <span className="block text-xs text-muted-foreground">
                      a.n. {m.account_name}
                    </span>
                  </button>
                );
              })}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">Info rekening belum tersedia.</p>
              )}
            </div>
            {errors.method && <p className="mt-1 text-xs text-destructive">{errors.method}</p>}
          </div>
          <Field label="Bukti pembayaran (gambar/PDF, maks 10 MB)" error={errors.proof}>
            <div className="space-y-3">
              {/* Single input approach - styled label with robust mobile handling */}
              <label 
                htmlFor="payment-proof-input"
                className={cn(
                  "block cursor-pointer rounded-xl border-2 border-dashed bg-card p-6 text-center transition-all active:scale-[0.98] touch-manipulation",
                  proof 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary hover:bg-primary/5",
                  compressing && "opacity-50 cursor-wait pointer-events-none"
                )}
              >
                {compressing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Memproses...</span>
                  </div>
                ) : proof ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    {/* Show checkmark icon always when file selected */}
                    <div className="rounded-full bg-primary/10 p-3">
                      <svg className="size-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    
                    {/* Preview gambar atau icon PDF */}
                    {previewUrl ? (
                      <div className="relative w-full max-w-xs rounded-lg overflow-hidden border-2 border-primary">
                        <img 
                          src={previewUrl} 
                          alt="Preview bukti pembayaran" 
                          className="w-full h-auto object-contain max-h-48"
                          onError={(e) => {
                            console.error('[RegisterForm] Image preview failed to load');
                            // Hide image on error but keep file info visible
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : proof.name.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex items-center justify-center w-full max-w-xs h-32 rounded-lg border-2 border-primary bg-primary/5">
                        <FileText className="size-12 text-primary" />
                      </div>
                    ) : null}
                    
                    {/* File info - always show */}
                    <div className="flex flex-col items-center gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">✓ File terpilih</p>
                        <p className="mt-1 text-xs text-muted-foreground break-all max-w-[250px] px-2">{proof.name}</p>
                        <p className="mt-1 text-xs font-mono text-muted-foreground">
                          {(proof.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {proof.type && (
                          <p className="mt-0.5 text-xs text-muted-foreground opacity-70">
                            {proof.type}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-primary font-medium mt-2">Tap untuk ganti foto</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <Upload className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Pilih Foto/File</p>
                      <p className="mt-1 text-xs text-muted-foreground">Tap untuk memilih dari gallery atau kamera</p>
                    </div>
                  </div>
                )}
              </label>
              
              {/* Single file input - NOT hidden, using opacity trick for better mobile compatibility */}
              <input
                id="payment-proof-input"
                type="file"
                accept="image/*,application/pdf"
                className="absolute opacity-0 w-0 h-0 overflow-hidden"
                onChange={handleFileChange}
                disabled={compressing}
                aria-label="Upload bukti pembayaran"
              />
            </div>
          </Field>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading || compressing}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : compressing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {loading ? "Mengirim..." : compressing ? "Memproses foto..." : "Daftar sekarang"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {event.is_paid
          ? "Tiket QR aktif setelah admin memverifikasi pembayaran Anda."
          : "Tiket QR langsung muncul setelah mendaftar."}
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
