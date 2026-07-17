import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getServerPaymentsEnv } from "@/lib/payments-env";
import { requireServerFeature } from "@/lib/env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  };
}

async function upsertSubscriptionFromStripe(event: StripeEvent, statusHint?: string) {
  const object = event.data.object;
  const subscriptionId = String(object.subscription ?? object.id ?? "");
  const customerId =
    typeof object.customer === "string" ? object.customer : (object.customer?.id ?? null);
  const planId = String(object.metadata?.plan_id ?? "");
  const userId = String(object.metadata?.user_id ?? "");

  const stripeSubscription =
    subscriptionId && event.type !== "customer.subscription.deleted"
      ? await fetchStripeSubscription(subscriptionId)
      : null;

  const currentPeriodEnd =
    stripeSubscription?.current_period_end && Number.isFinite(stripeSubscription.current_period_end)
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : null;

  const nextStatus =
    statusHint ??
    (stripeSubscription?.status === "trialing"
      ? "trialing"
      : stripeSubscription?.status === "past_due"
        ? "past_due"
        : stripeSubscription?.status === "canceled"
          ? "cancelled"
          : stripeSubscription?.status === "active"
            ? "active"
            : "pending");

  if (!userId && !customerId && !subscriptionId) return;

  const payload = {
    user_id: userId || null,
    plan_id: planId || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id:
      stripeSubscription?.items?.data?.[0]?.price?.id ?? object.metadata?.stripe_price_id ?? null,
    environment: getServerPaymentsEnv(),
    status: nextStatus,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: stripeSubscription?.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
    next_due_date: currentPeriodEnd,
  };

  const query = subscriptionId
    ? supabaseAdmin
        .from("subscriptions")
        .update(payload as any)
        .eq("stripe_subscription_id", subscriptionId)
    : supabaseAdmin
        .from("subscriptions")
        .update(payload as any)
        .eq("stripe_customer_id", customerId);
  const { error } = await query;
  if (error) throw error;

  if (userId) {
    await supabaseAdmin
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        status: nextStatus === "active" ? "active" : "pending",
      })
      .eq("id", userId);
  }
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

        try {
          rawBody = await currentRequest.text();
          const signature = currentRequest.headers.get("stripe-signature");
          if (!signature) return new Response("Missing Stripe signature", { status: 400 });

          const { STRIPE_WEBHOOK_SECRET: webhookSecret } = requireServerFeature(
            ["STRIPE_WEBHOOK_SECRET"],
            "Stripe webhook",
          );
          if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
            return new Response("Invalid signature", { status: 400 });
          }

          stripeEvent = JSON.parse(rawBody) as StripeEvent;
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
              await upsertSubscriptionFromStripe(stripeEvent, "active");
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscriptionFromStripe(stripeEvent);
              break;
            case "customer.subscription.deleted":
              await upsertSubscriptionFromStripe(stripeEvent, "cancelled");
              break;
            case "invoice.payment_succeeded":
              await upsertSubscriptionFromStripe(stripeEvent, "active");
              break;
            case "invoice.payment_failed":
              await upsertSubscriptionFromStripe(stripeEvent, "past_due");
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
