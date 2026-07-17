/**
 * Identifica o ambiente de pagamentos corrente: 'sandbox' (testes) ou 'live' (produção).
 *
 * O modo continua explícito para não misturar chaves de teste com produção.
 */
export type PaymentsEnv = "sandbox" | "live";

function normalize(value: string | undefined): PaymentsEnv {
  return value === "live" ? "live" : "sandbox";
}

/** Use em código do navegador (componentes, hooks). */
export function getClientPaymentsEnv(): PaymentsEnv {
  const v = (import.meta as any)?.env?.VITE_PAYMENTS_ENV as string | undefined;
  return normalize(v);
}

/** Use em código server-side (server functions, server routes). */
export function getServerPaymentsEnv(): PaymentsEnv {
  return normalize(process.env.PAYMENTS_ENV ?? process.env.APP_ENV);
}
