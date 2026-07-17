import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

/**
 * Rate limiting ad-hoc via tabela public.auth_attempts.
 *
 * As mensagens retornadas ao cliente são intencionalmente genéricas — não vazamos
 * contagem exata, se o e-mail existe, nem detalhes internos. Apenas "aguarde".
 *
 * Ações suportadas (livre — quem chama define): "login", "signup", "forgot_password", "webhook".
 */

type Action = "login" | "signup" | "forgot_password" | "webhook";

function getClientIp(): string {
  try {
    const req = getRequest();
    const fwd =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip");
    if (fwd) return fwd.split(",")[0].trim();
  } catch {
    // ignore
  }
  return "";
}

function getUA(): string {
  try {
    return getRequestHeader("user-agent") || "";
  } catch {
    return "";
  }
}

const LIMITS: Record<Action, { window: number; maxIp: number; maxEmail: number }> = {
  login: { window: 15, maxIp: 20, maxEmail: 8 },
  signup: { window: 60, maxIp: 10, maxEmail: 3 },
  forgot_password: { window: 60, maxIp: 10, maxEmail: 4 },
  webhook: { window: 5, maxIp: 200, maxEmail: 0 },
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number; message: string };

/**
 * Verifica se o cliente pode prosseguir. Não expõe contagens ao usuário.
 */
export const checkRateLimit = createServerFn({ method: "POST" })
  .inputValidator((data: { action: Action; email?: string | null }) => data)
  .handler(async ({ data }): Promise<RateLimitResult> => {
    const ip = getClientIp();
    const email = (data.email || "").trim().toLowerCase();
    const action = data.action as Action;
    const cfg = LIMITS[action] ?? LIMITS.login;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("check_auth_rate_limit", {
      _action: action,
      _ip: ip,
      _email: email ?? "",
      _window_minutes: cfg.window,
      _max_ip: cfg.maxIp,
      _max_email: cfg.maxEmail,
    });

    if (error) {
      // Falha do próprio limitador: não bloqueia o usuário legítimo.
      console.warn("[rate-limit] check falhou", error.message);
      return { ok: true };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.blocked) {
      return {
        ok: false,
        retryAfter: Number(row.retry_after_seconds ?? 60),
        message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      };
    }
    return { ok: true };
  });

/**
 * Registra o resultado da tentativa. Chame após concluir a ação.
 * Nunca lança — auditoria não pode quebrar a UX.
 */
export const recordAttempt = createServerFn({ method: "POST" })
  .inputValidator((data: { action: Action; email?: string | null; success: boolean }) => data)
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const email = (data.email || "").trim().toLowerCase();
    const ua = getUA().slice(0, 250);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("record_auth_attempt", {
        _action: data.action,
        _ip: ip,
        _email: email ?? "",
        _success: data.success,
        _user_agent: ua,
      });
    } catch (e) {
      console.warn("[rate-limit] record falhou", e);
    }
    return { ok: true };
  });
