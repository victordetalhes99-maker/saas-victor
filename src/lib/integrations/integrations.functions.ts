import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  INTEGRATION_REGISTRY,
  type IntegrationProvider,
  type IntegrationSnapshot,
  type IntegrationStatus,
  type JsonRecord,
} from "./types";

const providerSchema = z.enum([
  "supabase",
  "stripe",
  "resend",
  "whatsapp",
  "google_calendar",
  "cloudflare",
]);

type AdminContext = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  userId: string;
};

async function ensureAdmin(context: AdminContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado.");
}

type IntegrationRow = {
  provider: string;
  status: string;
  is_enabled: boolean;
  last_checked_at: string | null;
  last_sync_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  metadata: JsonRecord | null;
};

function buildSnapshot(
  provider: IntegrationProvider,
  configured: boolean,
  missing: string[],
  row: IntegrationRow | null,
): IntegrationSnapshot {
  let status: IntegrationStatus = "not_configured";
  if (row?.status) {
    status = row.status as IntegrationStatus;
  } else if (configured) {
    status = "action_required"; // configurado mas nunca testado
  }
  // Consistência: se as env vars sumiram, força not_configured
  if (!configured) status = "not_configured";

  return {
    provider,
    status,
    isEnabled: row?.is_enabled ?? false,
    isConfigured: configured,
    lastCheckedAt: row?.last_checked_at ?? null,
    lastSyncAt: row?.last_sync_at ?? null,
    lastErrorCode: row?.last_error_code ?? null,
    lastErrorMessage: row?.last_error_message ?? null,
    metadata: row?.metadata ?? {},
    missingEnvVars: missing,
  };
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context as unknown as AdminContext);

    const [{ supabaseAdmin }, adapters, store] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./adapters.server"),
      import("./secrets-store.server"),
    ]);

    const { data: rows } = await supabaseAdmin
      .from("integration_status")
      .select(
        "provider, status, is_enabled, last_checked_at, last_sync_at, last_error_code, last_error_message, metadata",
      );

    const byProvider = new Map<string, IntegrationRow>();
    for (const r of (rows ?? []) as IntegrationRow[]) byProvider.set(r.provider, r);

    const results: IntegrationSnapshot[] = [];
    for (const def of INTEGRATION_REGISTRY) {
      const configured = await adapters.isConfiguredWithOverlay(def.id);
      const missing = await adapters.missingEnvVarsWithOverlay(def.id);
      const configuredKeys = await store.listConfiguredKeys(def.id);
      const snap = buildSnapshot(def.id, configured, missing, byProvider.get(def.id) ?? null);
      snap.metadata = { ...(snap.metadata ?? {}), storedKeys: configuredKeys };
      results.push(snap);
    }
    return results;
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerSchema }).parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);

    const [{ supabaseAdmin }, adapters] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("./adapters.server"),
    ]);

    const startedAt = Date.now();
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "integration_test_started",
      entity: "integration",
      entity_id: data.provider,
      payload: {},
    });

    const configured = await adapters.isConfiguredWithOverlay(data.provider);
    if (!configured) {
      const missing = await adapters.missingEnvVarsWithOverlay(data.provider);
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "integration_configuration_missing",
        entity: "integration",
        entity_id: data.provider,
        payload: { missing },
      });
      await supabaseAdmin.from("integration_status").upsert(
        {
          provider: data.provider,
          status: "not_configured",
          is_enabled: false,
          last_checked_at: new Date().toISOString(),
          last_error_code: "not_configured",
          last_error_message: `Variáveis ausentes: ${missing.join(", ")}`,
          metadata: {},
        },
        { onConflict: "provider" },
      );
      return {
        ok: false,
        status: "not_configured" as const,
        code: "not_configured",
        message: "Configure as chaves e tente novamente.",
        missing,
        durationMs: Date.now() - startedAt,
      };
    }

    const result = await adapters.testConnection(data.provider);
    const durationMs = Date.now() - startedAt;
    const nowIso = new Date().toISOString();

    if (result.ok) {
      await supabaseAdmin.from("integration_status").upsert(
        {
          provider: data.provider,
          status: "connected",
          is_enabled: true,
          last_checked_at: nowIso,
          last_sync_at: nowIso,
          last_error_code: null,
          last_error_message: null,
          metadata: result.metadata,
        },
        { onConflict: "provider" },
      );
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "integration_test_success",
        entity: "integration",
        entity_id: data.provider,
        payload: { durationMs, metadata: result.metadata },
      });
      return {
        ok: true as const,
        status: "connected" as const,
        metadata: result.metadata,
        durationMs,
      };
    }

    const nextStatus: IntegrationStatus =
      result.code === "action_required" ? "action_required" : "error";
    await supabaseAdmin.from("integration_status").upsert(
      {
        provider: data.provider,
        status: nextStatus,
        is_enabled: false,
        last_checked_at: nowIso,
        last_error_code: result.code,
        last_error_message: result.message,
      },
      { onConflict: "provider" },
    );
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "integration_test_failed",
      entity: "integration",
      entity_id: data.provider,
      payload: { durationMs, code: result.code, message: result.message },
    });
    return {
      ok: false as const,
      status: nextStatus,
      code: result.code,
      message: result.message,
      durationMs,
    };
  });

const saveSchema = z.object({
  provider: providerSchema,
  keys: z.record(z.string().min(1), z.string()).refine((r) => Object.keys(r).length > 0, {
    message: "Nenhuma chave informada.",
  }),
});

export const saveIntegrationKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);
    const [store, { supabaseAdmin }] = await Promise.all([
      import("./secrets-store.server"),
      import("@/integrations/supabase/client.server"),
    ]);

    const def = INTEGRATION_REGISTRY.find((i) => i.id === data.provider);
    if (!def) throw new Error("Integração desconhecida.");
    const allowed = new Set(def.envVars.filter((v) => v.scope !== "public").map((v) => v.name));

    const saved: string[] = [];
    const cleared: string[] = [];
    for (const [name, rawValue] of Object.entries(data.keys)) {
      if (!allowed.has(name)) continue;
      const value = (rawValue ?? "").trim();
      if (value.length === 0) {
        await store.clearIntegrationSecret(data.provider, name);
        cleared.push(name);
      } else {
        await store.saveIntegrationSecret(data.provider, name, value, context.userId);
        saved.push(name);
      }
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "integration_keys_updated",
      entity: "integration",
      entity_id: data.provider,
      payload: { saved, cleared },
    });

    return { ok: true as const, saved, cleared };
  });

export const clearIntegrationKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ provider: providerSchema, keyName: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);
    const [store, { supabaseAdmin }] = await Promise.all([
      import("./secrets-store.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    await store.clearIntegrationSecret(data.provider, data.keyName);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "integration_key_cleared",
      entity: "integration",
      entity_id: data.provider,
      payload: { keyName: data.keyName },
    });
    return { ok: true as const };
  });
