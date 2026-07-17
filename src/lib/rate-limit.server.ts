/**
 * Helper server-only para rate limiting em rotas HTTP puras (webhooks).
 * Não usa createServerFn — pode ser chamado direto do handler da rota.
 */

const LIMITS = {
  webhook: { window: 5, maxIp: 200 },
} as const;

export async function checkWebhookRateLimit(
  ip: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("check_auth_rate_limit", {
      _action: "webhook",
      _ip: ip,
      _email: "",
      _window_minutes: LIMITS.webhook.window,
      _max_ip: LIMITS.webhook.maxIp,
      _max_email: 0,
    });
    if (error) return { ok: true, retryAfter: 0 };
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.blocked) return { ok: false, retryAfter: Number(row.retry_after_seconds ?? 60) };
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 };
  }
}

export async function recordWebhookAttempt(ip: string, success: boolean, userAgent?: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("record_auth_attempt", {
      _action: "webhook",
      _ip: ip,
      _email: "",
      _success: success,
      _user_agent: (userAgent || "").slice(0, 250),
    });
  } catch {
    // silencioso
  }
}
