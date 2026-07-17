import { randomBytes, createHash } from "node:crypto";
import { decryptSecret, encryptSecret, signPayload, verifySignedPayload } from "./crypto.server";
import { getAppOrigin, getServerEnv, requireServerFeature } from "./env.server";

const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_CODE_COOKIE = "google_oauth_verifier";

type OAuthState = {
  actorId: string;
  nextPath?: string;
  ts: number;
  nonce: string;
};

function base64UrlSha256(input: string) {
  return createHash("sha256").update(input).digest("base64url");
}

export function buildOAuthCookies(request: Request, actorId: string, nextPath?: string) {
  const env = requireServerFeature(
    ["GOOGLE_CLIENT_ID", "GOOGLE_REDIRECT_URI", "SESSION_SECRET", "ENCRYPTION_KEY"],
    "Google OAuth",
  );
  const clientId = env.GOOGLE_CLIENT_ID as string;
  const redirectUri = env.GOOGLE_REDIRECT_URI as string;
  const verifier = randomBytes(32).toString("base64url");
  const challenge = base64UrlSha256(verifier);
  const statePayload: OAuthState = {
    actorId,
    nextPath,
    ts: Date.now(),
    nonce: randomBytes(16).toString("base64url"),
  };
  const serialized = JSON.stringify(statePayload);
  const signature = signPayload(serialized);
  const state = Buffer.from(`${serialized}.${signature}`).toString("base64url");
  const secure = new URL(request.url).protocol === "https:";

  const cookies = [
    serializeCookie(GOOGLE_STATE_COOKIE, state, secure),
    serializeCookie(GOOGLE_CODE_COOKIE, encryptSecret(verifier), secure),
  ];

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { url: url.toString(), cookies };
}

export function parseCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function clearOAuthCookies(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return [
    serializeCookie(GOOGLE_STATE_COOKIE, "", secure, 0),
    serializeCookie(GOOGLE_CODE_COOKIE, "", secure, 0),
  ];
}

export function readOAuthState(request: Request) {
  const cookies = parseCookies(request);
  const rawState = cookies[GOOGLE_STATE_COOKIE];
  const rawVerifier = cookies[GOOGLE_CODE_COOKIE];
  if (!rawState || !rawVerifier) {
    throw new Error("Missing Google OAuth state cookies");
  }

  const decoded = Buffer.from(rawState, "base64url").toString("utf8");
  const split = decoded.lastIndexOf(".");
  if (split <= 0) throw new Error("Invalid Google OAuth state");
  const payload = decoded.slice(0, split);
  const signature = decoded.slice(split + 1);
  if (!verifySignedPayload(payload, signature)) {
    throw new Error("Invalid Google OAuth state signature");
  }
  const state = JSON.parse(payload) as OAuthState;
  if (Date.now() - state.ts > 15 * 60 * 1000) {
    throw new Error("Expired Google OAuth state");
  }
  return { state, verifier: decryptSecret(rawVerifier) };
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const env = requireServerFeature(
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    "Google OAuth token exchange",
  );
  const clientId = env.GOOGLE_CLIENT_ID as string;
  const clientSecret = env.GOOGLE_CLIENT_SECRET as string;
  const redirectUri = env.GOOGLE_REDIRECT_URI as string;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed with status ${res.status}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function refreshGoogleAccessToken(encryptedRefreshToken: string) {
  const env = requireServerFeature(
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    "Google token refresh",
  );
  const clientId = env.GOOGLE_CLIENT_ID as string;
  const clientSecret = env.GOOGLE_CLIENT_SECRET as string;
  const refreshToken = decryptSecret(encryptedRefreshToken);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed with status ${res.status}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function upsertGoogleConnection(
  supabaseAdmin: any,
  actorId: string,
  refreshToken: string | undefined,
  scope: string | undefined,
) {
  const metadata = {
    redirectUri: getServerEnv().GOOGLE_REDIRECT_URI,
    calendarId: getServerEnv().GOOGLE_CALENDAR_ID ?? "primary",
    connectedVia: getAppOrigin(),
  };
  const { error } = await supabaseAdmin.from("integration_connections" as any).upsert(
    {
      provider: "google_calendar",
      status: refreshToken ? "connected" : "error",
      encrypted_refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
      scopes: scope ? scope.split(" ") : [],
      metadata,
      connected_by: actorId,
      connected_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    } as any,
    { onConflict: "provider" },
  );
  if (error) throw new Error(error.message);
}

export async function getGoogleAccessToken(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("integration_connections" as any)
    .select("encrypted_refresh_token, status")
    .eq("provider", "google_calendar")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.encrypted_refresh_token || data.status !== "connected") {
    throw new Error("Google Calendar is not connected");
  }
  return refreshGoogleAccessToken(data.encrypted_refresh_token);
}

export async function createGoogleCalendarEvent(
  supabaseAdmin: any,
  payload: {
    appointmentId: string;
    title: string;
    description?: string;
    startIso: string;
    endIso: string;
  },
) {
  const env = getServerEnv();
  const token = await getGoogleAccessToken(supabaseAdmin);
  const calendarId = env.GOOGLE_CALENDAR_ID ?? "primary";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: payload.title,
        description: payload.description ?? "",
        start: { dateTime: payload.startIso, timeZone: env.APP_TIMEZONE },
        end: { dateTime: payload.endIso, timeZone: env.APP_TIMEZONE },
        extendedProperties: {
          private: {
            appointmentId: payload.appointmentId,
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Google Calendar create failed with status ${res.status}`);
  return (await res.json()) as { id?: string };
}

export async function deleteGoogleCalendarEvent(supabaseAdmin: any, eventId: string) {
  const env = getServerEnv();
  const token = await getGoogleAccessToken(supabaseAdmin);
  const calendarId = env.GOOGLE_CALENDAR_ID ?? "primary";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Calendar delete failed with status ${res.status}`);
  }
}

function serializeCookie(name: string, value: string, secure: boolean, maxAge = 900) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
