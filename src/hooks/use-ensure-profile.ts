import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Hook to ensure user has a profile in the profiles table.
 * If profile doesn't exist, it will attempt to create one from user metadata.
 * This fixes the "Profil Tidak Ditemukan" issue.
 */
export function useEnsureProfile(user: User | null) {
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfileExists(null);
      setIsChecking(false);
      return;
    }

    let isMounted = true;

    async function ensureProfile() {
      if (!isMounted) return;
      setIsChecking(true);

      try {
        // Check if profile exists with retry
        let existingProfile = null;
        let fetchError = null;
        
        // Retry up to 2 times with delay
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();
          
          existingProfile = result.data;
          fetchError = result.error;
          
          if (existingProfile || !fetchError) break;
          
          // Wait before retry
          if (attempt < 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        if (!isMounted) return;

        if (fetchError) {
          console.error("[useEnsureProfile] Error fetching profile:", fetchError);
          // Don't fail completely, just mark as not exists
          setProfileExists(false);
          setIsChecking(false);
          return;
        }

        // Profile exists, all good
        if (existingProfile) {
          console.log("[useEnsureProfile] Profile found");
          setProfileExists(true);
          setIsChecking(false);
          return;
        }

        // Profile doesn't exist, try to create it
        console.log("[useEnsureProfile] Profile not found, attempting to create...");

        const meta = user.user_metadata;
        const email = user.email;

        // Normalize WhatsApp number
        const rawWa = String(meta?.whatsapp || "").replace(/\D/g, "");
        const normalizedWa = rawWa.startsWith("0")
          ? "62" + rawWa.slice(1)
          : rawWa.startsWith("8")
            ? "62" + rawWa
            : rawWa;

        // Validate required fields
        if (!meta?.full_name || !normalizedWa || !email) {
          console.warn("[useEnsureProfile] Missing required metadata - user needs to complete profile manually");
          if (isMounted) {
            setProfileExists(false);
            setIsChecking(false);
          }
          return;
        }

        // Insert profile
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          full_name: String(meta.full_name).slice(0, 120).trim(),
          email: email.toLowerCase(),
          whatsapp: normalizedWa,
        });

        if (!isMounted) return;

        if (insertError) {
          // If duplicate key error, profile already exists
          if (insertError.message?.includes("duplicate") || insertError.code === "23505") {
            console.log("[useEnsureProfile] Profile already exists (duplicate key)");
            setProfileExists(true);
            setIsChecking(false);
            return;
          }
          
          console.error("[useEnsureProfile] Failed to create profile:", insertError);
          setProfileExists(false);
          setIsChecking(false);
          return;
        }

        console.log("[useEnsureProfile] Profile created successfully");
        setProfileExists(true);
        setIsChecking(false);
      } catch (error) {
        console.error("[useEnsureProfile] Unexpected error:", error);
        if (isMounted) {
          // Don't crash the page, just mark as profile doesn't exist
          setProfileExists(false);
          setIsChecking(false);
        }
      }
    }

    ensureProfile().catch((err) => {
      console.error("[useEnsureProfile] Top-level error:", err);
      if (isMounted) {
        setProfileExists(false);
        setIsChecking(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return { profileExists, isChecking };
}
