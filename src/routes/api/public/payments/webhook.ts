import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getServerPaymentsEnv } from "@/lib/payments-env";
import { requireServerFeature } from "@/lib/env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkWebhookRateLimit, recordWebhookAttempt } from "@/lib/rate-limit.server";

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, any> };
};

function parseStripeSignature(header: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return { timestamp, signatures };
}

function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(header);
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > 60 * 5) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return signatures.some((sig) => {
    const left = Buffer.from(sig, "hex");
    const right = Buffer.from(expected, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

async function fetchStripeSubscription(subscriptionId: string) {
  const { STRIPE_SECRET_KEY: secret } = requireServerFeature(
    ["STRIPE_SECRET_KEY"],
    "Stripe webhook",
  );
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Stripe-Version": "2024-06-20",
      },
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as {
    id: string;
    status: string;
    customer: string | { id: string };
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    items?: { data?: Array<{ price?: { id?: string } }> };
    metadata?: Record<string, string>;
  };
}

// Traduz o status de assinatura do Stripe para o enum interno.
// IMPORTANTE: nunca escreve em profiles.status aqui — esse campo pertence
// exclusivamente ao fluxo de aprovação cadastral (feito pela administração
// em /admin/solicitacoes). Situação financeira vive só em `subscriptions`.
function mapStripeStatus(stripeStatus: string | undefined): string {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
      return "incomplete";
    case "active":
      return "active";
    default:
      return "pending";
  }
}

async function upsertSubscriptionFromStripe(event: StripeEvent, statusHint?: string) {
  const object = event.data.object;
  const subscriptionId = String(object.subscription ?? object.id ?? "");
  const customerId =
    typeof object.customer === "string" ? object.customer : (object.customer?.id ?? null);

  const stripeSubscription =
    subscriptionId && event.type !== "customer.subscription.deleted"
      ? await fetchStripeSubscription(subscriptionId)
      : null;

  // metadata pode vir do evento direto (checkout session / subscription) ou,
  // em eventos de invoice, só está disponível na assinatura vinculada.
  const metadata = (object.metadata ?? stripeSubscription?.metadata ?? {}) as Record<
    string,
    string
  >;
  const planId = String(metadata.plan_id ?? "");
  const userId = String(metadata.user_id ?? "");

  const currentPeriodEnd =
    stripeSubscription?.current_period_end && Number.isFinite(stripeSubscription.current_period_end)
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : null;

  const nextStatus = statusHint ?? mapStripeStatus(stripeSubscription?.status);

  if (!userId && !customerId && !subscriptionId) return;

  const payload = {
    user_id: userId || null,
    plan_id: planId || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id:
      stripeSubscription?.items?.data?.[0]?.price?.id ?? metadata.stripe_price_id ?? null,
    environment: getServerPaymentsEnv(),
    status: nextStatus,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: stripeSubscription?.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
    next_due_date: currentPeriodEnd,
  };

  // Tenta casar por stripe_subscription_id (caso comum); se a assinatura
  // ainda não tiver esse id gravado (ex.: linha criada como "pending" no
  // momento do checkout, antes do Stripe confirmar), casa por customer.
  let matched = false;
  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update(payload as any)
      .eq("stripe_subscription_id", subscriptionId)
      .select("id");
    if (error) throw error;
    matched = (data?.length ?? 0) > 0;
  }
  if (!matched && customerId) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update(payload as any)
      .eq("stripe_customer_id", customerId)
      .is("stripe_subscription_id", null)
      .select("id");
    if (error) throw error;
    matched = (data?.length ?? 0) > 0;
  }
  // Nenhuma linha "pending" para casar (ex.: assinatura criada fora do
  // fluxo normal de checkout) — cria o registro para não perder o evento.
  if (!matched && userId) {
    const { error } = await supabaseAdmin.from("subscriptions").insert(payload as any);
    if (error) throw error;
  }

  // Mantém o stripe_customer_id no perfil para o Customer Portal funcionar.
  // NUNCA grava aqui o status de aprovação cadastral (profiles.status) —
  // isso é responsabilidade exclusiva do fluxo administrativo.
  if (userId && customerId) {
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  return { userId, subscriptionId, customerId };
}

// Registra o pagamento de fato (fatura paga ou recusada) na tabela
// `payments`, usada pela tela administrativa Pagamentos/Financeiro.
// Idempotente via unique index em stripe_invoice_id (ver migration).
async function recordPaymentFromInvoice(event: StripeEvent, status: "paid" | "failed") {
  const invoice = event.data.object;
  const invoiceId = String(invoice.id ?? "");
  if (!invoiceId) return;

  const subscriptionId = invoice.subscription ? String(invoice.subscription) : null;
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);

  // Descobre o cliente e a assinatura local a partir do que já sincronizamos.
  let userId: string | null = null;
  let localSubscriptionId: string | null = null;
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) {
      userId = data.user_id;
      localSubscriptionId = data.id;
    }
  }
  if (!userId && customerId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) {
    console.warn("[stripe-webhook] payment sem cliente identificável", invoiceId);
    return;
  }

  const amountCents = Number(status === "paid" ? invoice.amount_paid : invoice.amount_due) || 0;
  const paidAtUnix = invoice.status_transitions?.paid_at;

  const { error } = await supabaseAdmin.from("payments").upsert(
    {
      user_id: userId,
      subscription_id: localSubscriptionId,
      amount: amountCents / 100,
      currency: String(invoice.currency ?? "brl"),
      environment: getServerPaymentsEnv(),
      status,
      stripe_event_id: event.id,
      stripe_invoice_id: invoiceId,
      stripe_payment_intent_id:
        typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
      paid_at:
        status === "paid"
          ? paidAtUnix
            ? new Date(paidAtUnix * 1000).toISOString()
            : new Date().toISOString()
          : null,
    } as any,
    { onConflict: "stripe_invoice_id" },
  );
  if (error) throw error;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentRequest = request ?? getRequest();
        if (!currentRequest) return new Response("Request unavailable", { status: 500 });

        const env = getServerPaymentsEnv();
        let rawBody = "";
        let stripeEvent: StripeEvent | null = null;

        const clientIp =
          currentRequest.headers.get("cf-connecting-ip") ||
          currentRequest.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          currentRequest.headers.get("x-real-ip") ||
          "";
        const rateLimit = await checkWebhookRateLimit(clientIp);
        if (!rateLimit.ok) {
          return new Response("Too many requests", {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfter) },
          });
        }

        try {
          rawBody = await currentRequest.text();
          const signature = currentRequest.headers.get("stripe-signature");
          if (!signature) return new Response("Missing Stripe signature", { status: 400 });

          const { STRIPE_WEBHOOK_SECRET: webhookSecret } = requireServerFeature(
            ["STRIPE_WEBHOOK_SECRET"],
            "Stripe webhook",
          );
          if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
            void recordWebhookAttempt(clientIp, false);
            return new Response("Invalid signature", { status: 400 });
          }
          void recordWebhookAttempt(clientIp, true);

          stripeEvent = JSON.parse(rawBody) as StripeEvent;

          // --- Idempotência real -------------------------------------------------
          // Se este event.id já foi processado com sucesso antes (reentrega do
          // Stripe, replay manual, ou o próprio Stripe reenviando por não ter
          // recebido nosso 200 a tempo), responde OK sem reprocessar nada.
          const { data: existing } = await supabaseAdmin
            .from("payment_webhook_events")
            .select("status")
            .eq("event_id", stripeEvent.id)
            .maybeSingle();

          if (existing?.status === "processed") {
            return Response.json({ received: true, idempotent: true });
          }

          await supabaseAdmin.from("payment_webhook_events").upsert(
            {
              provider: "stripe",
              event_id: stripeEvent.id,
              event_type: stripeEvent.type,
              environment: env,
              payload: stripeEvent as any,
              status: "received",
            } as any,
            { onConflict: "event_id" },
          );

          switch (stripeEvent.type) {
            case "checkout.session.completed":
              // Vincula customer/subscription/plano. NÃO força "active": o
              // status real vem da assinatura consultada direto no Stripe
              // (ou fica "pending" até o invoice.paid confirmar o pagamento).
              await upsertSubscriptionFromStripe(stripeEvent);
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscriptionFromStripe(stripeEvent);
              break;
            case "customer.subscription.deleted":
              await upsertSubscriptionFromStripe(stripeEvent, "cancelled");
              break;
            case "invoice.paid":
            case "invoice.payment_succeeded":
              await upsertSubscriptionFromStripe(stripeEvent, "active");
              await recordPaymentFromInvoice(stripeEvent, "paid");
              break;
            case "invoice.payment_failed":
              await upsertSubscriptionFromStripe(stripeEvent, "past_due");
              await recordPaymentFromInvoice(stripeEvent, "failed");
              break;
            case "invoice.payment_action_required":
              await upsertSubscriptionFromStripe(stripeEvent, "incomplete");
              break;
            default:
              break;
          }

          await supabaseAdmin
            .from("payment_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error_message: null,
            } as any)
            .eq("event_id", stripeEvent.id);

          return Response.json({ received: true });
        } catch (error) {
          if (stripeEvent) {
            await supabaseAdmin
              .from("payment_webhook_events")
              .update({
                status: "error",
                error_message: error instanceof Error ? error.message : "Unknown error",
              } as any)
              .eq("event_id", stripeEvent.id);
          }
          const message = error instanceof Error ? error.message : "Webhook error";
          console.error("[stripe-webhook] processing failed", message);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
