import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { requireServerFeature } from "./env.server";

function deriveKey(secret: string) {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed)) {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4;
    const padded = normalized + "=".repeat((4 - padding) % 4);
    const key = Buffer.from(padded, "base64");
    if (key.length === 32) return key;
  }

  // Fallback: derive a 32-byte key deterministically from any secret via SHA-256.
  return createHash("sha256").update(trimmed, "utf8").digest();
}

export function signPayload(payload: string) {
  const secret = requireServerFeature(["SESSION_SECRET"], "Signed payloads")
    .SESSION_SECRET as string;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifySignedPayload(payload: string, signature: string) {
  return signPayload(payload) === signature;
}

export function encryptSecret(value: string) {
  const secret = requireServerFeature(["ENCRYPTION_KEY"], "Encrypted secrets")
    .ENCRYPTION_KEY as string;
  const iv = randomBytes(12);
  const key = deriveKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const secret = requireServerFeature(["ENCRYPTION_KEY"], "Encrypted secrets")
    .ENCRYPTION_KEY as string;
  const [ivB64, tagB64, encryptedB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const key = deriveKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
