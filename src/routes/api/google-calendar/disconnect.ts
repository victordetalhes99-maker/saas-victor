import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/google-calendar/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) return new Response("Request unavailable", { status: 500 });

        const authHeader = currentRequest.headers.get("authorization");
        const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!bearer) return new Response("Unauthorized", { status: 401 });

        const env = getServerEnv();
        const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data } = await client.auth.getUser(bearer);
        const userId = data.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { error } = await supabaseAdmin
          .from("integration_connections")
          .update({
            status: "disabled",
            encrypted_refresh_token: null,
            scopes: [],
            last_synced_at: new Date().toISOString(),
          } as any)
          .eq("provider", "google_calendar");

        if (error) {
          return new Response(error.message, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
