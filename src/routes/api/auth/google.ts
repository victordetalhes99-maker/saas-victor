import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";
import { buildOAuthCookies } from "@/lib/google-calendar.server";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) {
          return new Response("Request unavailable", { status: 500 });
        }

        const url = new URL(currentRequest.url);
        const authHeader = currentRequest.headers.get("authorization");
        const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const fallbackUserId = url.searchParams.get("user_id")?.trim() || null;
        const nextPath = url.searchParams.get("next")?.trim() || "/admin/configuracoes/integracoes";

        let actorId = fallbackUserId;
        if (bearer) {
          try {
            const env = getServerEnv();
            const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
              auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
            });
            const { data } = await client.auth.getUser(bearer);
            actorId = data.user?.id ?? actorId;
          } catch {
            // ignore and fall back to query parameter
          }
        }

        if (!actorId) {
          return new Response("Missing authenticated user", { status: 401 });
        }

        const { url: redirectUrl, cookies } = buildOAuthCookies(currentRequest, actorId, nextPath);
        const headers = new Headers({ Location: redirectUrl });
        for (const cookie of cookies) {
          headers.append("Set-Cookie", cookie);
        }
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
