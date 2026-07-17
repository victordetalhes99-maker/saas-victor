import { ServerEnvConfigError } from "./env.server";

type JsonBody = Record<string, unknown>;

export function jsonResponse(body: JsonBody, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

export function jsonError(status: number, error: string, message: string, headers?: HeadersInit) {
  return jsonResponse({ ok: false, error, message }, status, headers);
}

export function unauthorized(message = "Autenticação obrigatória.") {
  return jsonError(401, "unauthorized", message);
}

export function forbidden(message = "Acesso negado.") {
  return jsonError(403, "forbidden", message);
}

export function badRequest(message: string, error = "bad_request", headers?: HeadersInit) {
  return jsonError(400, error, message, headers);
}

export function methodNotAllowed(allow: string, message = "Método não permitido.") {
  return jsonError(405, "method_not_allowed", message, { Allow: allow });
}

export function serviceUnavailable(message: string, error = "service_unavailable") {
  return jsonError(503, error, message);
}

export function rethrowIfHttpResponse(error: unknown): never | void {
  if (error instanceof Response) {
    throw error;
  }
}

export function toConfigErrorResponse(error: unknown, message?: string) {
  if (error instanceof ServerEnvConfigError) {
    return serviceUnavailable(message ?? error.message, "config_error");
  }
  return null;
}
