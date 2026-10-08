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

    // Enhanced Android-compatible file handler with robust error handling
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("🔥 [ANDROID DEBUG] handleFileChange TRIGGERED!");
    console.log("🔥 [ANDROID DEBUG] UserAgent:", navigator.userAgent);
    console.log("🔥 [ANDROID DEBUG] Event target:", e.target);
    console.log("🔥 [ANDROID DEBUG] Files:", e.target.files);
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Enhanced file type detection - Android gallery files often have missing/incorrect MIME types
    const detectFileType = (file: File) => {
      const fileName = file.name.toLowerCase();
      const originalType = file.type;
      
      // Use filename extension as primary method for Android compatibility
      const isImageByExt = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(fileName);
      const isPdfByExt = fileName.endsWith('.pdf');
      
      // Fallback MIME type detection for gallery files
      let mimeType = originalType;
      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '') {
        if (isImageByExt) {
          const extMap: Record<string, string> = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'png': 'image/png', 'gif': 'image/gif',
            'webp': 'image/webp', 'heic': 'image/heic',
            'heif': 'image/heif', 'avif': 'image/avif',
            'bmp': 'image/bmp'
          };
          const ext = fileName.split('.').pop() || 'jpg';
          mimeType = extMap[ext] || 'image/jpeg';
        } else if (isPdfByExt) {
          mimeType = 'application/pdf';
        }
      }
      
      return { 
        isImage: isImageByExt || originalType.startsWith('image/'),
        isPdf: isPdfByExt || originalType === 'application/pdf',
        mimeType 
      };
    };

    // Safe state setters with error handling
    const safeSetState = async (setter: () => void, context: string) => {
      try {
        setter();
        return true;
      } catch (err) {
        console.error(`[RegisterForm] Error in ${context}:`, err);
        toast.error(`Gagal memproses file: ${context}`);
        return false;
      }
    };

    // Progressive preview generation with fallbacks
    const createPreviewSafely = async (file: File): Promise<string | null> => {
      // Strategy 1: createObjectURL (fastest, but may fail on Android)
      try {
        return URL.createObjectURL(file);
      } catch (error) {
        console.warn('[RegisterForm] createObjectURL failed, trying FileReader:', error);
      }
      
      // Strategy 2: FileReader (more compatible with Android browsers)
      try {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error('[RegisterForm] All preview methods failed:', error);
        return null;
      }
    };

    // Mobile browser detection for Android-specific handling
    const isMobileAndroid = () => {
      return /Android/i.test(navigator.userAgent);
    };

    // Main processing logic with comprehensive error handling
    try {
      // Clear previous errors
      if (!(await safeSetState(() => setErrors((prev) => ({ ...prev, proof: undefined })), 'clearing errors'))) {
        return;
      }

      // Cleanup old preview
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (err) {
          console.warn('[RegisterForm] Error revoking URL:', err);
        }
        if (!(await safeSetState(() => setPreviewUrl(null), 'clearing preview'))) {
          return;
        }
      }

      // Set processing state
      if (!(await safeSetState(() => setCompressing(true), 'setting processing state'))) {
        return;
      }

      // Enhanced file type detection
      const { isImage, isPdf, mimeType } = detectFileType(file);
      
      if (isMobileAndroid()) {
        console.log('[RegisterForm] Android browser detected - using enhanced compatibility mode');
        console.log('[RegisterForm] File details:', {
          name: file.name,
          originalType: file.type,
          detectedType: mimeType,
          isImage,
          isPdf,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        });
      }

      if (!isImage && !isPdf) {
        throw new Error('Format file tidak didukung. Gunakan gambar (JPG, PNG, WebP, HEIC) atau PDF.');
      }

      // File size validation
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal 10 MB');
      }

      // Create enhanced file object with corrected MIME type for Android compatibility
      const enhancedFile = new File([file], file.name, {
        type: mimeType,
        lastModified: file.lastModified
      });

      // Set file to state with enhanced error handling
      if (!(await safeSetState(() => setProof(enhancedFile), 'setting file to state'))) {
        throw new Error('Gagal menyimpan file. Coba refresh halaman dan upload ulang.');
      }

      // Generate preview for images with progressive fallback
      if (isImage) {
        try {
          const previewUrl = await createPreviewSafely(enhancedFile);
          if (previewUrl) {
            if (await safeSetState(() => setPreviewUrl(previewUrl), 'setting preview URL')) {
              console.log('[RegisterForm] Preview generated successfully');
            }
          } else {
            console.warn('[RegisterForm] Preview generation failed but continuing with upload');
            toast.warning('Preview tidak dapat dibuat, tapi file siap diupload');
          }
        } catch (previewError) {
          console.error('[RegisterForm] Preview generation failed:', previewError);
          toast.warning('Preview gagal dibuat, tapi file tetap siap diupload');
        }
      } else {
        // PDF: no preview needed
        await safeSetState(() => setPreviewUrl(null), 'clearing preview for PDF');
      }

      // Success notification
      toast.success(`✓ ${file.name} siap diupload`);

    } catch (error) {
      console.error('[RegisterForm] File processing error:', error);
      const message = error instanceof Error ? error.message : 'Gagal memproses file';
      
      // Show user-friendly error
      toast.error(message);
      
      // Clear file state on error
      await safeSetState(() => {
        setErrors((prev) => ({ ...prev, proof: message }));
        setProof(null);
        setPreviewUrl(null);
      }, 'clearing state on error');

      // Android-specific error context
      if (isMobileAndroid()) {
        console.error('[RegisterForm] Android-specific error context:', {
          userAgent: navigator.userAgent,
          fileDetails: file ? {
            name: file.name,
            type: file.type,
            size: file.size
          } : null,
          errorDetails: error
        });
      }
    } finally {
      // Always clear processing state
      await safeSetState(() => setCompressing(false), 'clearing processing state');
    }
  };;

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
            <div className="space-y-4">
              {/* Preview area */}
              {proof && (
                <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="rounded-full bg-primary/10 p-3">
                      <svg className="size-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    
                    {previewUrl ? (
                      <div className="relative w-full max-w-xs rounded-lg overflow-hidden border-2 border-primary">
                        <img 
                          src={previewUrl} 
                          alt="Preview bukti pembayaran" 
                          className="w-full h-auto object-contain max-h-48"
                          onError={(e) => {
                            console.error('[RegisterForm] Image preview failed to load');
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : proof.name.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex items-center justify-center w-full max-w-xs h-32 rounded-lg border-2 border-primary bg-primary/5">
                        <FileText className="size-12 text-primary" />
                      </div>
                    ) : null}
                    
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-semibold text-primary">✓ File terpilih</p>
                      <p className="text-xs text-muted-foreground break-all max-w-[250px] text-center">{proof.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {(proof.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* WORKING SOLUTION: Button-triggered file picker */}
              <div>
                <input
                  ref={(el) => {
                    if (el) {
                      el.onchange = handleFileChange;
                    }
                  }}
                  id="gallery-input"
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('gallery-input')?.click();
                  }}
                  disabled={compressing}
                  className={cn(
                    "w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all hover:border-primary hover:bg-primary/5",
                    compressing && "opacity-50 cursor-not-allowed",
                    proof ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <Upload className="size-6 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-semibold">
                      {proof ? "Ganti Foto/File" : "Pilih Foto/File dari Gallery"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proof ? "Klik untuk memilih file lain" : "Pilih bukti pembayaran dari gallery atau file PDF"}
                    </p>
                  </div>
                </button>
              </div>
              
              {compressing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memproses file...</span>
                </div>
              )}
              
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {proof ? 
                    "✅ File siap diupload!" : 
                    "Mendukung gambar (JPG, PNG, HEIC) dan PDF - maksimal 10MB"
                  }
                </p>
              </div>
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
