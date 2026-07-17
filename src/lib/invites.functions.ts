/**
 * Server functions do sistema de convites.
 * - validateInvite: pública, valida token e devolve info segura.
 * - acceptInvite: pública, cria/atualiza a conta Supabase e consome o convite.
 * - listInvites: admin only.
 * - resendInvite: admin only — gera novo token, atualiza convite, reenvia e-mail.
 * - revokeInvite: admin only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAppOrigin } from "@/lib/env.server";
import { requireServerFeature } from "@/lib/env.server";

const tokenSchema = z.object({ token: z.string().min(20).max(128) });

export const validateInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { hashToken } = await import("@/lib/invites.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("validate_invite_token", {
      _token_hash: hashToken(data.token),
    });
    if (error) return { ok: false as const, error: "invalid" };

    const inv = Array.isArray(rows) ? rows[0] : rows;
    if (!inv) return { ok: false as const, error: "invalid" };
    if (inv.status !== "pending") return { ok: false as const, error: inv.status };

    let planName: string | null = null;
    if (inv.plan_id) {
      const { data: pl } = await supabaseAdmin
        .from("plans")
        .select("name")
        .eq("id", inv.plan_id)
        .maybeSingle();
      planName = pl?.name ?? null;
    }
    return {
      ok: true as const,
      email: inv.email as string,
      fullName: (inv.full_name as string | null) ?? null,
      planName,
      expiresAt: inv.expires_at as string,
    };
  });

const acceptSchema = z.object({
  token: z.string().min(20).max(128),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120).optional(),
});

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data }) => {
    const { hashToken } = await import("@/lib/invites.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokenHash = hashToken(data.token);

    // 1) Valida convite
    const { data: rows } = await supabaseAdmin.rpc("validate_invite_token", {
      _token_hash: tokenHash,
    });
    const inv = (Array.isArray(rows) ? rows[0] : rows) as {
      id: string;
      email: string;
      full_name: string | null;
      plan_id: string | null;
      status: string;
    } | null;
    if (!inv) return { ok: false as const, error: "invalid" };
    if (inv.status !== "pending") return { ok: false as const, error: inv.status };

    // 2) Consome (status=used) — protege contra reuso concorrente
    const { data: consumedId } = await supabaseAdmin.rpc("consume_invite_token", {
      _token_hash: tokenHash,
    });
    if (!consumedId) return { ok: false as const, error: "invalid" };

    // 3) Cria/atualiza usuário Auth com senha definida
    const email = inv.email.toLowerCase();
    let userId: string | null = null;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? inv.full_name ?? "" },
    });
    if (createErr) {
      // Pode já existir — busca e atualiza senha
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email);
      if (!found) return { ok: false as const, error: "user_create_failed" };
      userId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(userId!, { password: data.password });
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) return { ok: false as const, error: "user_create_failed" };

    // 4) Vincula informações Stripe ao profile + cria/atualiza assinatura como ATIVA
    //    (o checkout já foi aprovado antes do convite ser gerado).
    const { data: invFull } = await supabaseAdmin
      .from("invites")
      .select("*")
      .eq("id", inv.id)
      .maybeSingle();
    if (invFull?.stripe_customer_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: invFull.stripe_customer_id })
        .eq("id", userId);
    }

    if (invFull?.stripe_subscription_id) {
      // Consulta o Stripe para refletir o status real (active/trialing/past_due/...)
      // e o current_period_end. Se a consulta falhar, assumimos "active" porque o
      // checkout.session.completed já garantiu pagamento aprovado.
      type SubStatus = "active" | "trialing" | "past_due" | "cancelled" | "incomplete" | "pending";
      let liveStatus: SubStatus = "active";
      let currentPeriodEnd: string | null = null;
      let cancelAtPeriodEnd = false;
      let resolvedPriceId: string | null = invFull.stripe_price_id ?? null;
      let resolvedPlanId: string | null = invFull.plan_id ?? null;
      try {
        const { STRIPE_SECRET_KEY: key } = requireServerFeature(
          ["STRIPE_SECRET_KEY"],
          "Stripe subscription lookup",
        );
        if (key) {
          const res = await fetch(
            `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(invFull.stripe_subscription_id)}`,
            { headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20" } },
          );
          const sub: any = await res.json();
          if (res.ok) {
            const item = sub.items?.data?.[0];
            const map: Record<string, SubStatus> = {
              active: "active",
              trialing: "trialing",
              past_due: "past_due",
              canceled: "cancelled",
              unpaid: "past_due",
              incomplete: "incomplete",
              incomplete_expired: "cancelled",
              paused: "cancelled",
            };
            liveStatus = map[String(sub.status)] ?? "active";
            const cpe = item?.current_period_end ?? sub.current_period_end;
            if (typeof cpe === "number") currentPeriodEnd = new Date(cpe * 1000).toISOString();
            cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
            const livePriceId = item?.price?.id;
            if (livePriceId && !resolvedPriceId) resolvedPriceId = livePriceId;
            if (!resolvedPlanId && livePriceId) {
              const { data: pl } = await supabaseAdmin
                .from("plans")
                .select("id")
                .eq("stripe_price_id", livePriceId)
                .maybeSingle();
              if (pl?.id) resolvedPlanId = pl.id;
            }
          }
        }
      } catch (e) {
        console.warn("[acceptInvite] stripe retrieve falhou — assumindo active", e);
      }

      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_subscription_id", invFull.stripe_subscription_id)
        .maybeSingle();

      const base = {
        status: liveStatus,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
        ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
      };

      if (existing) {
        // Webhook pode ter criado a linha antes da ativação — vincula ao user e ativa.
        await supabaseAdmin
          .from("subscriptions")
          .update({
            ...base,
            user_id: userId,
            ...(resolvedPlanId ? { plan_id: resolvedPlanId } : {}),
            ...(resolvedPriceId ? { stripe_price_id: resolvedPriceId } : {}),
            ...(invFull.stripe_customer_id
              ? { stripe_customer_id: invFull.stripe_customer_id }
              : {}),
          })
          .eq("id", existing.id);
      } else if (resolvedPlanId) {
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan_id: resolvedPlanId,
          stripe_subscription_id: invFull.stripe_subscription_id,
          stripe_customer_id: invFull.stripe_customer_id,
          stripe_price_id: resolvedPriceId,
          environment: "live",
          ...base,
        });
      } else {
        console.warn("[acceptInvite] sem plan_id resolvível para criar assinatura");
      }
    }
    return { ok: true as const };
  });

// --- Admin ----------------------------------------------------------------

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invites")
      .select(
        "id,email,full_name,plan_id,status,expires_at,used_at,last_sent_at,send_count,created_at,stripe_subscription_id",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    // Marca expirados (sem mutar status no banco)
    const now = Date.now();
    const enriched = (data ?? []).map((r: any) => ({
      ...r,
      effective_status:
        r.status === "pending" && new Date(r.expires_at).getTime() < now ? "expired" : r.status,
    }));
    return { invites: enriched };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteId: string }) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("invites")
      .select("*")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (error || !inv) throw new Error("Convite não encontrado");
    if (inv.status === "used") throw new Error("Convite já utilizado");

    // Gera novo token e nova expiração de 48h
    const { randomBytes } = await import("crypto");
    const { hashToken } = await import("@/lib/invites.server");
    const { sendResendEmail, inviteEmailHtml } = await import("@/lib/resend.server");

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("invites")
      .update({
        token_hash: hashToken(token),
        status: "pending",
        expires_at: expiresAt,
        last_sent_at: new Date().toISOString(),
        send_count: (inv.send_count ?? 0) + 1,
      })
      .eq("id", inv.id);

    let planName: string | null = null;
    if (inv.plan_id) {
      const { data: pl } = await supabaseAdmin
        .from("plans")
        .select("name")
        .eq("id", inv.plan_id)
        .maybeSingle();
      planName = pl?.name ?? null;
    }
    const origin = getAppOrigin();
    const activationUrl = `${origin}/ativar?token=${token}`;
    await sendResendEmail({
      to: inv.email,
      subject: "Ative sua conta no Clube Detail",
      html: inviteEmailHtml({
        fullName: inv.full_name ?? undefined,
        activationUrl,
        planName: planName ?? undefined,
      }),
    });
    return { ok: true };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteId: string }) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invites").update({ status: "revoked" }).eq("id", data.inviteId);
    return { ok: true };
  });
