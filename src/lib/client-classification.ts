// Regra central de classificação de status do cliente, usada pela tela
// administrativa de Clientes (filtros, badges e contadores). Extraída para
// arquivo próprio para poder ser testada isoladamente — um bug aqui faz o
// admin ver o status financeiro/cadastral errado de um cliente real.

export type ClientBucket =
  | "all"
  | "awaiting_payment"
  | "payment_review"
  | "active"
  | "expired"
  | "blocked"
  | "incomplete"
  | "cancelled";

export type ClassifiableClient = {
  status?: string | null;
  subscriptions?: Array<{ status?: string | null }> | null;
  payments?: Array<{ status?: string | null }> | null;
  vehicles?: unknown[] | null;
};

export function classifyClient(c: ClassifiableClient): ClientBucket {
  const sub = c.subscriptions?.[0];
  const latestPayment = c.payments?.[0];

  // Bloqueio administrativo tem prioridade sobre qualquer estado financeiro.
  if (c.status === "blocked") return "blocked";
  if (sub?.status === "cancelled") return "cancelled";
  if (sub?.status === "expired" || sub?.status === "past_due") return "expired";
  if (sub?.status === "active" && c.status === "active") return "active";
  if (latestPayment && latestPayment.status === "pending") return "payment_review";
  if (sub && sub.status === "pending") return "awaiting_payment";
  if (!sub || !c.vehicles?.length || c.status === "pending") return "incomplete";
  return "incomplete";
}
