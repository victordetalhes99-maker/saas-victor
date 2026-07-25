import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { buildOAuthCookies } from "@/lib/google-calendar.server";
import { ForbiddenError, UnauthorizedError, requireAdminRequest } from "@/lib/authz.server";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) {
          return new Response("Request unavailable", { status: 500 });
        }

        // SECURITY: the actor id MUST come from a verified bearer token.
        // There is no fallback to an unauthenticated `user_id` query
        // parameter — that previously let anyone start the OAuth flow
        // and link an arbitrary Google account to this business's
        // (single, shared) calendar integration. This endpoint also now
        // requires the caller to hold an admin/owner role, since
        // integration_connections is a single global row, not per-user.
        let actorId: string;
        try {
          actorId = await requireAdminRequest(currentRequest);
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            return new Response("Missing authenticated user", { status: 401 });
          }
          if (error instanceof ForbiddenError) {
            return new Response("Admin access required", { status: 403 });
          }
          throw error;
        }

        const url = new URL(currentRequest.url);
        const nextPath = url.searchParams.get("next")?.trim() || "/admin/configuracoes/integracoes";

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
