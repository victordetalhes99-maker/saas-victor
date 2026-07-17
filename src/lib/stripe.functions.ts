import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getServerPaymentsEnv } from "@/lib/payments-env";
import { ServerEnvConfigError, getAppOrigin, requireServerFeature } from "@/lib/env.server";
import { badRequest, jsonError, serviceUnavailable } from "@/lib/http.server";

const checkoutInputSchema = z.object({ planId: z.string().uuid() });

async function stripeFetch(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams }) {
  let env: { STRIPE_SECRET_KEY: string };
  try {
    env = requireServerFeature(["STRIPE_SECRET_KEY"], "Stripe API");
  } catch (error) {
    if (error instanceof ServerEnvConfigError) {
      throw serviceUnavailable(error.message, "config_error");
    }
    throw error;
  }

  const res = await fetch(`https://api.stripe.com${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: init.body?.toString(),
  });

  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) {
    console.error("[stripe] api error", res.status, json.error?.message ?? "unknown");
    throw jsonError(502, "stripe_api_error", "Falha ao se comunicar com o Stripe.");
  }

  return json;
}

function getCheckoutUrls() {
  try {
    const env = requireServerFeature(["APP_URL"], "Stripe checkout URLs");
    return {
      success:
        process.env.STRIPE_SUCCESS_URL?.trim() ||
        `${env.APP_URL.replace(/\/+$/, "")}/dashboard?checkout=success`,
      cancel:
        process.env.STRIPE_CANCEL_URL?.trim() ||
        `${env.APP_URL.replace(/\/+$/, "")}/dashboard?checkout=canceled`,
      portalReturn:
        process.env.STRIPE_PORTAL_RETURN_URL?.trim() ||
        `${env.APP_URL.replace(/\/+$/, "")}/dashboard?billing=returned`,
    };
  } catch (error) {
    if (error instanceof ServerEnvConfigError) {
      throw serviceUnavailable(error.message, "config_error");
    }
    throw error;
  }
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string })?.email;
    if (!email) {
      throw badRequest("E-mail do usuário indisponível.", "missing_user_email");
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, stripe_price_id, active")
      .eq("id", data.planId)
      .eq("active", true)
      .maybeSingle();

    if (planError || !plan) {
      throw jsonError(404, "plan_not_found", "Plano indisponível.");
    }

    if (!plan.stripe_price_id) {
      throw badRequest("Plano sem stripe_price_id configurado.", "missing_price_id");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const created = await stripeFetch("/v1/customers", {
        method: "POST",
        body: new URLSearchParams({
          email,
          name: profile?.full_name || "",
          "metadata[user_id]": userId,
        }),
      });
      customerId = String(created.id);
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const urls = getCheckoutUrls();
    const body = new URLSearchParams({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      "line_items[0][price]": plan.stripe_price_id,
      "line_items[0][quantity]": "1",
      success_url: urls.success,
      cancel_url: urls.cancel,
      "metadata[user_id]": userId,
      "metadata[plan_id]": plan.id,
      "metadata[source]": "app",
      "subscription_data[metadata][user_id]": userId,
      "subscription_data[metadata][plan_id]": plan.id,
      "subscription_data[metadata][source]": "app",
      allow_promotion_codes: "true",
      "automatic_tax[enabled]": "false",
    });

    const session = await stripeFetch("/v1/checkout/sessions", { method: "POST", body });

    await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_id: plan.id,
      status: "pending",
      stripe_customer_id: customerId,
      stripe_price_id: plan.stripe_price_id,
      stripe_checkout_url: String(session.url ?? ""),
      environment: getServerPaymentsEnv(),
    });

    return { url: String(session.url ?? "") };
  });

export const createStripePortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      throw jsonError(404, "stripe_customer_not_found", "Cliente Stripe não encontrado.");
    }

    const urls = getCheckoutUrls();
    const session = await stripeFetch("/v1/billing_portal/sessions", {
      method: "POST",
      body: new URLSearchParams({
        customer: profile.stripe_customer_id,
        return_url: urls.portalReturn || `${getAppOrigin()}/dashboard`,
      }),
    });

    return { url: String(session.url ?? "") };
  });
