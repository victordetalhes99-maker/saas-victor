/**
 * Store server-only de segredos por integração.
 * Nunca importe do cliente — sufixo .server.ts é bloqueado pelo bundler.
 *
 * Overlay: se existir um valor no banco (criptografado), ele sobrescreve
 * o process.env em runtime para aquela integração/chave.
 */
import process from "node:process";
import { encryptSecret, decryptSecret } from "@/lib/crypto.server";

type CacheEntry = { value: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKey(provider: string, keyName: string) {
  return `${provider}:${keyName}`;
}

export async function loadIntegrationSecret(
  provider: string,
  keyName: string,
): Promise<string | null> {
  const key = cacheKey(provider, keyName);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value || null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_secrets" as any)
    .select("encrypted_value")
    .eq("provider", provider)
    .eq("key_name", keyName)
    .maybeSingle();

  let value = "";
  const encrypted = (data as { encrypted_value?: string } | null)?.encrypted_value;
  if (encrypted) {
    try {
      value = decryptSecret(encrypted);
    } catch {
      value = "";
    }
  }
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value || null;
}

/**
 * Obtem o valor de um segredo priorizando o overlay do banco. Se não
 * houver, cai para process.env.
 */
export async function getIntegrationEnv(
  provider: string,
  keyName: string,
): Promise<string | undefined> {
  const stored = await loadIntegrationSecret(provider, keyName);
  if (stored) return stored;
  const fromEnv = process.env[keyName];
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv : undefined;
}

export async function saveIntegrationSecret(
  provider: string,
  keyName: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const encrypted = encryptSecret(value);
  const { error } = await supabaseAdmin.from("integration_secrets" as any).upsert(
    {
      provider,
      key_name: keyName,
      encrypted_value: encrypted,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,key_name" },
  );
  if (error) throw new Error(error.message);
  cache.delete(cacheKey(provider, keyName));
}

export async function clearIntegrationSecret(provider: string, keyName: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("integration_secrets" as any)
    .delete()
    .eq("provider", provider)
    .eq("key_name", keyName);
  if (error) throw new Error(error.message);
  cache.delete(cacheKey(provider, keyName));
}

export async function listConfiguredKeys(provider: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_secrets" as any)
    .select("key_name")
    .eq("provider", provider);
  return ((data ?? []) as unknown as Array<{ key_name: string }>).map((r) => r.key_name);
}
