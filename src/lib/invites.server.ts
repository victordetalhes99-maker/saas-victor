/**
 * Helpers server-only para o sistema de convites.
 * - createInviteAndSend: gera token único, grava hash, envia e-mail.
 * - hashToken: SHA-256 hex.
 */
import { createHash, randomBytes } from "crypto";
import { inviteEmailHtml, sendResendEmail, subscriptionActivatedHtml } from "./resend.server";
import { getAppOrigin } from "./env.server";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInviteAndSend(
  supabaseAdmin: any,
  opts: {
    email: string;
    fullName?: string;
    planId?: string | null;
    planName?: string | null;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripePriceId?: string | null;
    createdBy?: string | null;
    environment?: "sandbox" | "live";
  },
): Promise<{ inviteId: string; activationUrl: string } | null> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return null;

  const token = randomBytes(32).toString("base64url");
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("invites")
    .insert({
      email,
      token_hash,
      full_name: opts.fullName ?? null,
      plan_id: opts.planId ?? null,
      stripe_subscription_id: opts.stripeSubscriptionId ?? null,
      stripe_customer_id: opts.stripeCustomerId ?? null,
      stripe_price_id: opts.stripePriceId ?? null,
      status: "pending",
      expires_at,
      created_by: opts.createdBy ?? null,
      environment: opts.environment ?? "sandbox",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[invites] create error", error);
    return null;
  }

  const activationUrl = `${getAppOrigin()}/ativar?token=${token}`;
  try {
    await sendResendEmail({
      to: email,
      subject: "Ative sua conta no Clube Detail",
      html: inviteEmailHtml({
        fullName: opts.fullName,
        activationUrl,
        planName: opts.planName ?? undefined,
      }),
    });
  } catch (e) {
    console.error("[invites] resend error", e);
    // Mantém o convite gravado mesmo se o e-mail falhar — admin pode reenviar.
  }
  return { inviteId: data.id, activationUrl };
}

export async function sendActivatedEmail(opts: {
  email: string;
  fullName?: string;
  planName?: string | null;
}) {
  try {
    await sendResendEmail({
      to: opts.email,
      subject: "Sua assinatura está ativa",
      html: subscriptionActivatedHtml({
        fullName: opts.fullName,
        planName: opts.planName ?? undefined,
        appUrl: getAppOrigin(),
      }),
    });
  } catch (e) {
    console.error("[invites] activated email error", e);
  }
}
