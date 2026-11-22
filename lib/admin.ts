import "server-only";
import type { User } from "@supabase/supabase-js";

/**
 * True when the signed-in user's confirmed email equals ADMIN_EMAIL.
 * ADMIN_EMAIL is server-only; if it isn't set, nobody is an admin.
 */
export function isAdmin(user: User | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !user?.email || !user.email_confirmed_at) return false;
  return user.email.trim().toLowerCase() === adminEmail;
}
