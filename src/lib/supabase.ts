import { supabase } from '@/integrations/supabase/client';

/**
 * React hook to access Supabase client in components
 * This is a simple wrapper around the imported supabase instance
 */
export function useSupabase() {
  return supabase;
}

export { supabase };
