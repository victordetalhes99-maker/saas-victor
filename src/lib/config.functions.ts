import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerFeature } from "@/lib/env.server";

// Configurações do estabelecimento — Fase A do Centro de Configurações.
// Apenas o Owner pode escrever; admins podem ler (garantido pela RLS,
// mas re-validado no servidor por defesa em profundidade).

const companySchema = z.object({
  logo_url: z
    .string()
    .trim()
    .url()
    .max(500)
    .nullable()
    .or(z.literal("").transform(() => null)),
  legal_name: z.string().trim().max(160).nullable(),
  trade_name: z.string().trim().max(160).nullable(),
  cnpj: z.string().trim().max(20).nullable(),
  phone: z.string().trim().max(30).nullable(),
  whatsapp: z.string().trim().max(30).nullable(),
  email: z
    .string()
    .trim()
    .max(160)
    .nullable()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "E-mail inválido" }),
  instagram: z.string().trim().max(80).nullable(),
  facebook: z.string().trim().max(120).nullable(),
  website: z.string().trim().max(160).nullable(),
  cep: z.string().trim().max(10).nullable(),
  address: z.string().trim().max(200).nullable(),
  address_number: z.string().trim().max(20).nullable(),
  address_complement: z.string().trim().max(120).nullable(),
  city: z.string().trim().max(80).nullable(),
  state: z.string().trim().max(2).nullable(),
  min_booking_lead_minutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 7),
  cancellation_deadline_hours: z
    .number()
    .int()
    .min(0)
    .max(24 * 30),
  allow_walkins: z.boolean(),
  allow_reschedule: z.boolean(),
});

type Ctx = { supabase: any; userId: string };

async function ensureOwner(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o Owner pode alterar as configurações.");
}

export const updateCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureOwner(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("company_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    const payload = { ...data, updated_by: context.userId, updated_at: new Date().toISOString() };

    if (!existing) {
      const { error } = await supabaseAdmin.from("company_settings").insert(payload);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("company_settings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "company_settings_updated",
      entity: "company_settings",
      entity_id: existing?.id ?? null,
      payload: { keys: Object.keys(data) },
    });

    return { ok: true };
  });

// -------- Perfil do administrador logado ---------------------------------

const adminProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  display_name: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  job_title: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
});

export const updateAdminProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        display_name: data.display_name ?? null,
        phone: data.phone ?? null,
        job_title: data.job_title ?? null,
        avatar_url: data.avatar_url ?? null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Alterar senha do administrador logado --------------------------

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual obrigatória"),
  newPassword: z
    .string()
    .min(10, "Senha deve ter no mínimo 10 caracteres")
    .max(128)
    .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
      message: "Use letras maiúsculas, minúsculas e números.",
    }),
});

export const changeAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => passwordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Descobre o e-mail para reautenticar.
    const { data: userInfo, error: uErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (uErr || !userInfo.user?.email) throw new Error("Não foi possível localizar o usuário.");
    const email = userInfo.user.email;

    // Reautentica com a senha atual usando um client anônimo — evita usar o service role.
    const { createClient } = await import("@supabase/supabase-js");
    const env = requireServerFeature(
      ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
      "Admin password validation",
    );
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { error: signErr } = await anon.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signErr) throw new Error("Senha atual incorreta.");

    // Atualiza a senha via admin API.
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (updErr) throw new Error(updErr.message);

    // Encerra todas as sessões antigas (força novo login em outros dispositivos).
    try {
      await supabaseAdmin.auth.admin.signOut(context.userId);
    } catch (e) {
      console.warn("[changeAdminPassword] signOut falhou", e);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "admin_password_changed",
      entity: "auth.users",
      entity_id: context.userId,
      payload: {},
    });

    return { ok: true };
  });

// -------- Preferências de notificação (empresa) --------------------------

const notificationChannelSchema = z.object({
  system: z.boolean(),
  email: z.boolean(),
  whatsapp: z.boolean(),
});
const notificationPrefsSchema = z.object({
  new_client: notificationChannelSchema,
  new_payment: notificationChannelSchema,
  pending_payment: notificationChannelSchema,
  new_appointment: notificationChannelSchema,
  cancellation: notificationChannelSchema,
  reschedule: notificationChannelSchema,
  security_alert: notificationChannelSchema,
  system_error: notificationChannelSchema,
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => notificationPrefsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureOwner(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("company_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    const payload = {
      notification_prefs: data,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (!existing) {
      const { error } = await supabaseAdmin.from("company_settings").insert(payload);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("company_settings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "notification_prefs_updated",
      entity: "company_settings",
      entity_id: existing?.id ?? null,
      payload: {},
    });
    return { ok: true };
  });

// -------- Regras da agenda (subset editável de company_settings) ---------

const agendaRulesSchema = z.object({
  min_booking_lead_minutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 7),
  cancellation_deadline_hours: z
    .number()
    .int()
    .min(0)
    .max(24 * 30),
  allow_walkins: z.boolean(),
  allow_reschedule: z.boolean(),
});

export const updateAgendaRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agendaRulesSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureOwner(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("company_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    const payload = { ...data, updated_by: context.userId, updated_at: new Date().toISOString() };
    if (!existing) {
      const { error } = await supabaseAdmin.from("company_settings").insert(payload);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("company_settings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "agenda_rules_updated",
      entity: "company_settings",
      entity_id: existing?.id ?? null,
      payload: data,
    });
    return { ok: true };
  });

// -------- Preferências de aparência do administrador (per-user) ----------

const appearancePrefsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  density: z.enum(["comfortable", "compact"]),
  reduceMotion: z.boolean(),
});
export type AppearancePrefs = z.infer<typeof appearancePrefsSchema>;

export const updateAppearancePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => appearancePrefsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ appearance_prefs: data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
