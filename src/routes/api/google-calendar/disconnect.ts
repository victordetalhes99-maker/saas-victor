import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ForbiddenError, UnauthorizedError, requireAdminRequest } from "@/lib/authz.server";

export const Route = createFileRoute("/api/google-calendar/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) return new Response("Request unavailable", { status: 500 });

        // SECURITY: previously any authenticated user (including a plain
        // client account) could disconnect the business's shared Google
        // Calendar integration. This is a staff-only action.
        try {
          await requireAdminRequest(currentRequest);
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            return new Response("Unauthorized", { status: 401 });
          }
          if (error instanceof ForbiddenError) {
            return new Response("Admin access required", { status: 403 });
          }
          throw error;
        }

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
