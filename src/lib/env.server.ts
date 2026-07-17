import process from "node:process";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env.public";

type ServerEnvMap = Record<string, string | undefined>;

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("Clube Detail"),
  APP_URL: z.string().url(),
  APP_TIMEZONE: z.string().min(1).default("America/Fortaleza"),
  ALLOWED_ORIGINS: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().url().optional(),
  SUBSCRIPTION_GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).default(3),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  EMAIL_REPLY_TO: z.string().min(3).optional(),
  ADMIN_ALERT_EMAIL: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_ID: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine(isValidEncryptionKey, "must be 32 bytes encoded as hex or base64/base64url")
    .optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: z.string().url().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;
type ServerEnvKey = keyof ServerEnv;

const aliasMap: Record<string, string[]> = {
  SUPABASE_ANON_KEY: ["SUPABASE_PUBLISHABLE_KEY"],
  STRIPE_SECRET_KEY: ["STRIPE_LIVE_API_KEY", "STRIPE_SANDBOX_API_KEY"],
  STRIPE_WEBHOOK_SECRET: ["PAYMENTS_LIVE_WEBHOOK_SECRET", "PAYMENTS_SANDBOX_WEBHOOK_SECRET"],
  EMAIL_FROM: ["RESEND_FROM_EMAIL"],
};

let cachedEnv: ServerEnv | null = null;
let cachedNormalizedEnv: ServerEnvMap | null = null;
let cachedValues = new Map<ServerEnvKey, ServerEnv[ServerEnvKey]>();

export class ServerEnvConfigError extends Error {
  readonly keys: string[];

  constructor(message: string, keys: string[]) {
    super(formatEnvError(message));
    this.name = "ServerEnvConfigError";
    this.keys = keys;
  }
}

function normalizeBase64Value(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  if (padding === 1) return null;
  return normalized + "=".repeat((4 - padding) % 4);
}

function isValidEncryptionKey(value: string) {
  // Aceita 32 bytes em hex, base64/base64url ou qualquer string >= 16 chars
  // (derivada via SHA-256 em runtime).
  return value.trim().length >= 16;
}

function getTrimmedValue(source: ServerEnvMap, name: string): string | undefined {
  const direct = source[name]?.trim();
  if (direct) return direct;
  for (const alias of aliasMap[name] ?? []) {
    const value = source[alias]?.trim();
    if (value) return value;
  }
  return undefined;
}

function normalizeServerEnv(source: ServerEnvMap): ServerEnvMap {
  const env: ServerEnvMap = {};
  for (const key of Object.keys(serverEnvSchema.shape)) {
    const value = getTrimmedValue(source, key);
    if (value) env[key] = value;
  }

  try {
    const publicEnv = getPublicEnv();
    env.SUPABASE_URL ||= publicEnv.VITE_SUPABASE_URL;
    env.SUPABASE_ANON_KEY ||= publicEnv.VITE_SUPABASE_ANON_KEY;
  } catch {
    // Keep server env normalization resilient when public build-time vars are absent.
  }

  if (!env.EMAIL_FROM) {
    const name = source.RESEND_FROM_NAME?.trim();
    const email = source.RESEND_FROM_EMAIL?.trim();
    if (name && email) env.EMAIL_FROM = `${name} <${email}>`;
  }

  return env;
}

function formatEnvError(message: string) {
  return `Invalid server environment configuration: ${message}`;
}

function getNormalizedServerEnv() {
  if (!cachedNormalizedEnv) {
    cachedNormalizedEnv = normalizeServerEnv(process.env);
  }
  return cachedNormalizedEnv;
}

function getKeySchema<K extends ServerEnvKey>(key: K) {
  return serverEnvSchema.shape[key];
}

function parseServerEnvKey<K extends ServerEnvKey>(key: K): ServerEnv[K] {
  if (cachedValues.has(key)) {
    return cachedValues.get(key) as ServerEnv[K];
  }

  const normalized = getNormalizedServerEnv();
  const result = getKeySchema(key).safeParse(normalized[key]);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ServerEnvConfigError(`${String(key)}: ${issue?.message ?? "invalid value"}`, [
      String(key),
    ]);
  }

  cachedValues.set(key, result.data as ServerEnv[ServerEnvKey]);
  return result.data as ServerEnv[K];
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = Object.fromEntries(
      Object.keys(serverEnvSchema.shape).map((key) => [
        key,
        parseServerEnvKey(key as ServerEnvKey),
      ]),
    ) as ServerEnv;
  }
  return cachedEnv;
}

export function resetServerEnvForTests() {
  cachedEnv = null;
  cachedNormalizedEnv = null;
  cachedValues = new Map();
}

export function getServerEnvValue<K extends ServerEnvKey>(key: K): ServerEnv[K] {
  return parseServerEnvKey(key);
}

export function requireServerFeature<K extends keyof ServerEnv>(
  keys: K[],
  reason: string,
): Required<Pick<ServerEnv, K>> {
  const values = {} as Pick<ServerEnv, K>;
  const missing: string[] = [];

  for (const key of keys) {
    const value = parseServerEnvKey(key);
    if (value === undefined || value === null || value === "") {
      missing.push(String(key));
      continue;
    }
    values[key] = value;
  }

  if (missing.length > 0) {
    throw new ServerEnvConfigError(
      `${reason} requires ${missing.map(String).join(", ")} to be configured`,
      missing,
    );
  }
  return values as Required<Pick<ServerEnv, K>>;
}

export function getAppOrigin() {
  return getServerEnvValue("APP_URL").replace(/\/+$/, "");
}

export function getAllowedOrigins() {
  const raw = getServerEnvValue("ALLOWED_ORIGINS");
  if (!raw) return [getAppOrigin()];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
