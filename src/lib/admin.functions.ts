import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAppOrigin } from "@/lib/env.server";

const roleSchema = z.enum(["admin", "operator", "manager", "attendant", "client"]);

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

export const updateUserStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: roleSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Somente o Owner pode alterar acessos administrativos.
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const callerIsOwner = (callerRoles ?? []).some((r) => r.role === "owner");
    if (!callerIsOwner) {
      throw new Error("Somente o Owner pode alterar acessos administrativos.");
    }

    if (data.userId === context.userId) {
      throw new Error("Você não pode alterar o próprio papel.");
    }

    // O Owner é imutável pela API.
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((targetRoles ?? []).some((r) => r.role === "owner")) {
      throw new Error("O Owner não pode ser alterado pela interface.");
    }

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["admin", "operator", "manager", "attendant"]);

    if (data.role !== "client") {
      const { error } = await supabaseAdmin.from("user_roles").insert({
        user_id: data.userId,
        role: data.role,
      });

      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "user_role_updated",
      entity: "user_roles",
      entity_id: data.userId,
      payload: { role: data.role },
    });

    return { ok: true };
  });

// ---------- Suspensão / Reativação de acesso ------------------------------

export const suspendUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        reasonCode: z
          .enum([
            "overdue",
            "payment_refused",
            "subscription_cancelled",
            "admin_request",
            "misuse",
            "policy_violation",
            "other",
          ])
          .optional(),
        reason: z.string().trim().max(500).optional(),
        suspensionType: z.enum(["until_regularization", "until_date", "days"]).optional(),
        untilDate: z.string().trim().max(40).optional(),
        days: z.number().int().min(1).max(3650).optional(),
        notifyChannel: z.enum(["none", "email", "whatsapp", "both"]).optional(),
        notifyMessage: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.userId === context.userId) {
      throw new Error("Você não pode suspender a própria conta.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        status: "blocked",
        blocked_at: new Date().toISOString(),
        blocked_by: context.userId,
        blocked_reason: data.reason ?? null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    try {
      await supabaseAdmin.auth.admin.signOut(data.userId);
    } catch (e) {
      console.warn("[suspendUserAccess] signOut falhou", e);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "user_access_suspended",
      entity: "profiles",
      entity_id: data.userId,
      payload: {
        reasonCode: data.reasonCode ?? null,
        reason: data.reason ?? null,
        suspensionType: data.suspensionType ?? null,
        untilDate: data.untilDate ?? null,
        days: data.days ?? null,
        notifyChannel: data.notifyChannel ?? "none",
        notifyMessage: data.notifyMessage ?? null,
      },
    });

    return { ok: true };
  });

export const restoreUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        allowLogin: z.boolean().optional(),
        allowBooking: z.boolean().optional(),
        notifyChannel: z.enum(["none", "email", "whatsapp", "both"]).optional(),
        notifyMessage: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        status: "active",
        blocked_at: null,
        blocked_by: null,
        blocked_reason: null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "user_access_restored",
      entity: "profiles",
      entity_id: data.userId,
      payload: {
        allowLogin: data.allowLogin ?? true,
        allowBooking: data.allowBooking ?? true,
        notifyChannel: data.notifyChannel ?? "none",
        notifyMessage: data.notifyMessage ?? null,
      },
    });

    return { ok: true };
  });

// Aliases legados para compatibilidade retroativa.
export const blockUserAccount = suspendUserAccess;
export const unblockUserAccount = restoreUserAccess;

// ---------- Criação de cliente pelo administrador -------------------------

export const createClientByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().nullable(),
        planId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("crypto");

    // Se o cliente já se cadastrou antes, reaproveitamos o mesmo Auth e apenas
    // promovemos o cadastro para ativo. Isso evita quebrar a senha que ele já criou.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .eq("email", data.email)
      .maybeSingle();

    const findExistingAuthUser = async (email: string) => {
      let page = 1;
      for (;;) {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 100,
        });
        if (error) throw new Error(error.message);

        const match = users.users.find((u: any) => (u.email ?? "").toLowerCase() === email);
        if (match) return match;
        if (users.users.length < 100) return null;
        page += 1;
      }
    };

    const existingAuthUser = await findExistingAuthUser(data.email);

    const upsertApprovedProfile = async (userId: string) => {
      const payload = {
        id: userId,
        email: data.email,
        full_name: data.fullName,
        phone: data.phone ?? null,
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
      };
      await supabaseAdmin.from("profiles").upsert(payload, { onConflict: "id" });
    };

    if (existingProfile && existingAuthUser) {
      const userId = existingProfile.id;
      await upsertApprovedProfile(userId);

      if (data.planId) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan_id: data.planId,
          status: "active",
          washes_used: 0,
          next_due_date: dueDate.toISOString().slice(0, 10),
        });
      }

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "client_approved",
        entity: "profiles",
        entity_id: userId,
        payload: { email: data.email, reusedExistingAuth: true },
      });

      return { ok: true, userId, activationLink: null };
    }

    if (existingProfile && !existingAuthUser) {
      throw new Error(
        "Existe um perfil sem conta Auth correspondente. Corrija o cadastro antes de aprovar.",
      );
    }

    if (!existingProfile && existingAuthUser) {
      const userId = existingAuthUser.id;
      await upsertApprovedProfile(userId);

      if (data.planId) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan_id: data.planId,
          status: "active",
          washes_used: 0,
          next_due_date: dueDate.toISOString().slice(0, 10),
        });
      }

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "client_approved",
        entity: "profiles",
        entity_id: userId,
        payload: { email: data.email, reusedExistingAuth: true, createdProfile: true },
      });

      return { ok: true, userId, activationLink: null };
    }

    // 1) Cria usuário Auth com senha aleatória — cliente definirá via link seguro.
    const tempPassword = randomBytes(24).toString("base64url");
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? undefined },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Não foi possível criar o usuário.");
    }
    const userId = created.user.id;

    // 2) O trigger handle_new_user() já provisiona profile + user_roles=client.
    //    Ajustamos status para 'active' (admin já aprovou) e complementamos dados.
    await upsertApprovedProfile(userId);

    // 3) Assinatura opcional
    if (data.planId) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        plan_id: data.planId,
        status: "active",
        washes_used: 0,
        next_due_date: dueDate.toISOString().slice(0, 10),
      });
    }

    // 4) Gera link de definição de senha (recovery) para o admin repassar.
    const origin = getAppOrigin();
    let activationLink: string | null = null;
    try {
      const { data: link } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: `${origin}/reset-password` },
      });
      activationLink = (link as any)?.properties?.action_link ?? null;
    } catch (e) {
      console.warn("[createClientByAdmin] generateLink falhou", e);
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "client_created_by_admin",
      entity: "profiles",
      entity_id: userId,
      payload: { email: data.email, planId: data.planId ?? null },
    });

    return { ok: true, userId, activationLink };
  });

// ---------- Criação de acesso administrativo (Owner) ----------------------

async function ensureOwner(context: AdminContext) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: callerRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const callerIsOwner = (callerRoles ?? []).some((r) => r.role === "owner");
  if (!callerIsOwner) {
    throw new Error("Somente o Owner pode gerenciar acessos administrativos.");
  }
}

const internalRoleSchema = z.enum(["admin", "operator", "manager", "attendant"]);

export const createInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email("E-mail inválido."),
        fullName: z.string().trim().min(2, "Informe o nome completo.").max(120),
        password: z.string().min(8, "Senha deve ter ao menos 8 caracteres.").max(128),
        role: internalRoleSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureOwner(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica duplicidade por profiles.email
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existingProfile) {
      throw new Error("Já existe um usuário cadastrado com este e-mail.");
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "";
      if (/already been registered|already exists|duplicate/i.test(msg)) {
        throw new Error("Já existe um usuário cadastrado com este e-mail.");
      }
      throw new Error(msg || "Não foi possível criar o usuário.");
    }
    const userId = created.user.id;

    // Trigger handle_new_user provisiona profile + role 'client'.
    // Ajustamos status para active e trocamos o papel para o cargo interno.
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        email: data.email,
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
      })
      .eq("id", userId);

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["client", "admin", "operator", "manager", "attendant"]);

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
    });
    if (roleErr) throw new Error(roleErr.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "internal_user_created",
      entity: "user_roles",
      entity_id: userId,
      payload: { email: data.email, role: data.role },
    });

    return { ok: true, userId };
  });

export const deleteInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureOwner(context as unknown as AdminContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.userId === context.userId) {
      throw new Error("Você não pode revogar o próprio acesso.");
    }

    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((targetRoles ?? []).some((r) => r.role === "owner")) {
      throw new Error("O Owner não pode ser removido pela interface.");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "internal_user_deleted",
      entity: "auth.users",
      entity_id: data.userId,
      payload: {},
    });

    return { ok: true };
  });
