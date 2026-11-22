import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. It BYPASSES Row Level Security, so:
 * - only import it in server code (the "server-only" import enforces this),
 * - only call it after isAdmin() has passed,
 * - always scope queries (e.g. .is("owner", null)) so it can't touch tutors' own rows.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't set.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
