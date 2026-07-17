/**
 * Adaptadores server-only para cada integração.
 * NUNCA importe este arquivo do cliente — o sufixo .server.ts é bloqueado
 * pelo bundler.
 *
 * Cada adaptador expõe:
 *   - isConfigured(): env vars presentes?
 *   - missingEnvVars(): quais faltam
 *   - testConnection(): chamada real ao provedor, retorno sanitizado
 *   - getPublicMetadata(): dados seguros para o painel
 */
import process from "node:process";
import {
  INTEGRATION_REGISTRY,
  type IntegrationDefinition,
  type IntegrationProvider,
  type JsonRecord,
} from "./types";
import { getServerEnv } from "@/lib/env.server";

const REQUEST_TIMEOUT_MS = 10_000;

export type TestResult =
  | {
      ok: true;
      metadata: JsonRecord;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

function definitionOf(id: IntegrationProvider): IntegrationDefinition {
  const def = INTEGRATION_REGISTRY.find((i) => i.id === id);
  if (!def) throw new Error(`Provider inválido: ${id}`);
  return def;
}

function isPresent(name: string): boolean {
  const aliases: Record<string, string[]> = {
    SUPABASE_ANON_KEY: ["SUPABASE_PUBLISHABLE_KEY"],
    VITE_SUPABASE_ANON_KEY: ["VITE_SUPABASE_PUBLISHABLE_KEY"],
    STRIPE_SECRET_KEY: ["STRIPE_LIVE_API_KEY", "STRIPE_SANDBOX_API_KEY"],
    STRIPE_WEBHOOK_SECRET: ["PAYMENTS_LIVE_WEBHOOK_SECRET", "PAYMENTS_SANDBOX_WEBHOOK_SECRET"],
    EMAIL_FROM: ["RESEND_FROM_EMAIL"],
  };
  const v = process.env[name] ?? aliases[name]?.map((alias) => process.env[alias]).find(Boolean);
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Presença considerando também o overlay do banco (integration_secrets).
 */
async function hasSecret(provider: IntegrationProvider, name: string): Promise<boolean> {
  if (isPresent(name)) return true;
  const { loadIntegrationSecret } = await import("./secrets-store.server");
  const v = await loadIntegrationSecret(provider, name);
  return typeof v === "string" && v.trim().length > 0;
}

async function getSecret(provider: IntegrationProvider, name: string): Promise<string | undefined> {
  const { getIntegrationEnv } = await import("./secrets-store.server");
  const overlay = await getIntegrationEnv(provider, name);
  return overlay ?? undefined;
}

export function missingEnvVars(id: IntegrationProvider): string[] {
  return definitionOf(id)
    .envVars.filter((v) => v.required && v.scope !== "public" && !isPresent(v.name))
    .map((v) => v.name);
}

export async function missingEnvVarsWithOverlay(id: IntegrationProvider): Promise<string[]> {
  const def = definitionOf(id);
  const missing: string[] = [];
  for (const v of def.envVars) {
    if (!v.required || v.scope === "public") continue;
    if (!(await hasSecret(id, v.name))) missing.push(v.name);
  }
  return missing;
}

/**
 * Considera "configurada" quando todas as env vars *server* obrigatórias
 * estão presentes (env ou overlay do banco). Vars públicas VITE_* são
 * presença de build-time e não chegam ao runtime — não são avaliadas aqui.
 */
export function isConfigured(id: IntegrationProvider): boolean {
  return definitionOf(id)
    .envVars.filter((v) => v.required && v.scope === "server")
    .every((v) => isPresent(v.name));
}

export async function isConfiguredWithOverlay(id: IntegrationProvider): Promise<boolean> {
  const def = definitionOf(id);
  for (const v of def.envVars) {
    if (!v.required || v.scope !== "server") continue;
    if (!(await hasSecret(id, v.name))) return false;
  }
  return true;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function sanitizeError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) {
    if (err.name === "AbortError")
      return { code: "timeout", message: "Tempo de resposta excedido." };
    // Não retornar stack. Mensagens típicas de fetch são seguras.
    return { code: "provider_error", message: err.message.slice(0, 200) };
  }
  return { code: "unknown_error", message: "Erro desconhecido ao consultar o provedor." };
}

// ---------- Supabase ----------
async function testSupabase(): Promise<TestResult> {
  if (!isConfigured("supabase")) {
    return { ok: false, code: "not_configured", message: "Variáveis Supabase ausentes." };
  }
  try {
    const env = getServerEnv();
    const url = env.SUPABASE_URL;
    // Endpoint de saúde do PostgREST — não expõe dados, exige apenas apikey.
    const res = await fetchWithTimeout(`${url}/rest/v1/`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok && res.status !== 404 && res.status !== 200) {
      return {
        ok: false,
        code: `http_${res.status}`,
        message: "Supabase não respondeu como esperado.",
      };
    }
    let projectRef: string | undefined;
    try {
      projectRef = new URL(url).host.split(".")[0];
    } catch {
      /* ignore */
    }
    return { ok: true, metadata: { projectRef, region: res.headers.get("x-sb-region") ?? null } };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

// ---------- Stripe ----------
async function testStripe(): Promise<TestResult> {
  const key = await getSecret("stripe", "STRIPE_SECRET_KEY");
  if (!key) {
    return { ok: false, code: "not_configured", message: "STRIPE_SECRET_KEY ausente." };
  }
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/account", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": "2024-06-20",
      },
    });
    if (res.status === 401)
      return { ok: false, code: "invalid_key", message: "Chave Stripe inválida." };
    if (!res.ok)
      return { ok: false, code: `http_${res.status}`, message: "Stripe recusou a requisição." };
    const json = (await res.json()) as {
      id?: string;
      country?: string;
      default_currency?: string;
      charges_enabled?: boolean;
      livemode?: boolean;
    };
    const webhookSecret = await getSecret("stripe", "STRIPE_WEBHOOK_SECRET");
    return {
      ok: true,
      metadata: {
        environment: json.livemode ? "live" : "sandbox",
        publishableConfigured: Boolean(
          process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY,
        ),
        country: json.country ?? null,
        defaultCurrency: json.default_currency ?? null,
        chargesEnabled: json.charges_enabled ?? null,
        livemode: json.livemode ?? null,
        webhookConfigured: Boolean(webhookSecret),
      },
    };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

// ---------- Resend ----------
async function testResend(): Promise<TestResult> {
  const key = await getSecret("resend", "RESEND_API_KEY");
  if (!key) return { ok: false, code: "not_configured", message: "RESEND_API_KEY ausente." };
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401)
      return { ok: false, code: "invalid_key", message: "API key do Resend inválida." };
    if (!res.ok)
      return { ok: false, code: `http_${res.status}`, message: "Resend recusou a requisição." };
    const json = (await res.json()) as { data?: Array<{ name: string; status: string }> };
    const domains = Array.isArray(json.data)
      ? json.data.map((d) => ({ name: d.name, status: d.status }))
      : [];
    const from = await getSecret("resend", "EMAIL_FROM");
    return {
      ok: true,
      metadata: {
        domains,
        fromEmail: from ?? null,
      },
    };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

// ---------- WhatsApp (abstrato) ----------
async function testWhatsApp(): Promise<TestResult> {
  const provider = await getSecret("whatsapp", "WHATSAPP_PROVIDER");
  const apiUrl = await getSecret("whatsapp", "WHATSAPP_API_URL");
  const token = await getSecret("whatsapp", "WHATSAPP_API_TOKEN");
  if (!provider || !apiUrl || !token) {
    return {
      ok: false,
      code: "not_configured",
      message: "Provider, URL ou token do WhatsApp ausentes.",
    };
  }
  try {
    const res = await fetchWithTimeout(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: "invalid_credentials",
        message: "Credenciais do WhatsApp rejeitadas.",
      };
    }
    if (res.status >= 500) {
      return { ok: false, code: `http_${res.status}`, message: "Provedor WhatsApp indisponível." };
    }
    const phoneNumberId = await getSecret("whatsapp", "WHATSAPP_PHONE_NUMBER_ID");
    const businessAccountId = await getSecret("whatsapp", "WHATSAPP_BUSINESS_ACCOUNT_ID");
    return {
      ok: true,
      metadata: {
        provider,
        phoneNumberId: phoneNumberId ?? null,
        businessAccountId: businessAccountId ?? null,
      },
    };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

// ---------- Google Calendar ----------
async function testGoogleCalendar(): Promise<TestResult> {
  if (!isConfigured("google_calendar")) {
    return { ok: false, code: "not_configured", message: "Credenciais Google ausentes." };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_connections" as any)
    .select("status, connected_at")
    .eq("provider", "google_calendar")
    .maybeSingle();
  const connection = data as { status?: string; connected_at?: string | null } | null;
  if (connection?.status !== "connected") {
    return {
      ok: false,
      code: "action_required",
      message: "Conta ainda não conectada. Complete o fluxo OAuth do Google Calendar.",
    };
  }
  try {
    const { getGoogleAccessToken } = await import("@/lib/google-calendar.server");
    const { access_token } = await getGoogleAccessToken(supabaseAdmin);
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const calRes = await fetchWithTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!calRes.ok) {
      return { ok: false, code: `http_${calRes.status}`, message: "Calendário inacessível." };
    }
    const cal = (await calRes.json()) as { summary?: string; timeZone?: string };
    return {
      ok: true,
      metadata: {
        calendarId,
        summary: cal.summary ?? null,
        timeZone: cal.timeZone ?? null,
        connectedAt: connection.connected_at ?? null,
      },
    };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

// ---------- Cloudflare ----------
async function testCloudflare(): Promise<TestResult> {
  const accountId = await getSecret("cloudflare", "CLOUDFLARE_ACCOUNT_ID");
  const token = await getSecret("cloudflare", "CLOUDFLARE_API_TOKEN");
  if (!accountId || !token) {
    return {
      ok: true,
      metadata: {
        mode: "deploy_only",
        runtimeWorkerVarsRequired: false,
        configuredLocally: false,
      },
    };
  }
  try {
    const res = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, code: "invalid_credentials", message: "Token Cloudflare rejeitado." };
    }
    if (!res.ok)
      return { ok: false, code: `http_${res.status}`, message: "Cloudflare recusou a requisição." };
    const json = (await res.json()) as { result?: { name?: string } };
    const zoneId = await getSecret("cloudflare", "CLOUDFLARE_ZONE_ID");
    const projectName = await getSecret("cloudflare", "CLOUDFLARE_PROJECT_NAME");
    return {
      ok: true,
      metadata: {
        mode: "deploy_only",
        runtimeWorkerVarsRequired: false,
        configuredLocally: true,
        accountName: json.result?.name ?? null,
        zoneId: zoneId ?? null,
        projectName: projectName ?? null,
      },
    };
  } catch (err) {
    return { ok: false, ...sanitizeError(err) };
  }
}

export async function testConnection(id: IntegrationProvider): Promise<TestResult> {
  switch (id) {
    case "supabase":
      return testSupabase();
    case "stripe":
      return testStripe();
    case "resend":
      return testResend();
    case "whatsapp":
      return testWhatsApp();
    case "google_calendar":
      return testGoogleCalendar();
    case "cloudflare":
      return testCloudflare();
  }
}
