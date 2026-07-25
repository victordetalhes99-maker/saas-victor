// Server-only authorization helpers for plain API route handlers
// (src/routes/api/**) that don't go through the requireSupabaseAuth
// createServerFn middleware and therefore need to verify both the
// bearer token AND the caller's staff/admin role by hand.
//
// SECURITY: Always resolve the acting user from a verified bearer token
// (never from an unauthenticated query/body parameter) before calling these.

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export class UnauthorizedError extends Error {
  readonly status = 401;
}

export class ForbiddenError extends Error {
  readonly status = 403;
}

/**
 * Verifies the "Authorization: Bearer <token>" header on a request and
 * returns the authenticated user id. Throws UnauthorizedError otherwise.
 * There is intentionally NO fallback to query/body parameters here.
 */
export async function requireBearerUserId(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearer) throw new UnauthorizedError("Missing bearer token");

  const env = getServerEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data.user?.id) throw new UnauthorizedError("Invalid or expired token");
  return data.user.id;
}

/**
 * Throws ForbiddenError unless the given user id has the "admin" or
 * "owner" role. Uses the service-role client (bypasses RLS) because this
 * is precisely the kind of privileged check RLS can't express for a
 * cross-cutting "am I staff" question.
 */
export async function requireAdminUserId(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const isAdmin = (data ?? []).some((row) => ADMIN_ROLES.has(row.role as string));
  if (!isAdmin) throw new ForbiddenError("Admin access required");
}

/**
 * Convenience: verifies the bearer token AND that the resulting user is
 * an admin/owner. Returns the verified user id.
 */
export async function requireAdminRequest(request: Request): Promise<string> {
  const userId = await requireBearerUserId(request);
  await requireAdminUserId(userId);
  return userId;
}
