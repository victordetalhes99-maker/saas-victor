import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import {
  clearOAuthCookies,
  exchangeGoogleCode,
  readOAuthState,
  upsertGoogleConnection,
} from "@/lib/google-calendar.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) return new Response("Request unavailable", { status: 500 });

        const url = new URL(currentRequest.url);
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");
        if (!code || !stateParam) {
          return new Response("Missing OAuth parameters", { status: 400 });
        }

        try {
          const { state, verifier } = readOAuthState(currentRequest);
          const token = await exchangeGoogleCode(code, verifier);
          await upsertGoogleConnection(
            supabaseAdmin,
            state.actorId,
            token.refresh_token,
            token.scope,
          );

          const headers = new Headers({
            Location: state.nextPath || "/admin/configuracoes/integracoes",
          });
          for (const cookie of clearOAuthCookies(currentRequest)) {
            headers.append("Set-Cookie", cookie);
          }
          return new Response(null, { status: 302, headers });
        } catch (error) {
          const headers = new Headers({
            Location: "/admin/configuracoes/integracoes?google=error",
          });
          for (const cookie of clearOAuthCookies(currentRequest)) {
            headers.append("Set-Cookie", cookie);
          }
          return new Response(error instanceof Error ? error.message : "OAuth error", {
            status: 302,
            headers,
          });
        }
      },
    },
  },
});
