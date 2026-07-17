import { z } from "zod";

const publicEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("Clube Detail"),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_SUPPORT_WHATSAPP_NUMBER: z.string().min(8).optional(),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedEnv: PublicEnv | null = null;

function pickPublicEnv() {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    VITE_APP_NAME: env.VITE_APP_NAME,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_STRIPE_PUBLISHABLE_KEY: env.VITE_STRIPE_PUBLISHABLE_KEY,
    VITE_SUPPORT_WHATSAPP_NUMBER: env.VITE_SUPPORT_WHATSAPP_NUMBER,
    VITE_TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY,
  };
}

export function getPublicEnv(): PublicEnv {
  if (!cachedEnv) {
    const parsed = publicEnvSchema.safeParse(pickPublicEnv());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".") || "unknown";
      throw new Error(`Invalid public environment configuration: ${path}: ${issue?.message}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

export function resetPublicEnvForTests() {
  cachedEnv = null;
}

export function getSupportWhatsAppUrl(message: string): string | null {
  const number = getPublicEnv().VITE_SUPPORT_WHATSAPP_NUMBER;
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
