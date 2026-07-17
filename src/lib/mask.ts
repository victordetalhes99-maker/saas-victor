// LGPD: utilitários para mascarar dados pessoais na UI quando o valor
// completo não é necessário (ex: listagens administrativas, logs).

export function maskEmail(value?: string | null): string {
  if (!value) return "—";
  const [local, domain] = value.split("@");
  if (!domain) return "—";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function maskPhone(value?: string | null): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "•".repeat(digits.length);
  return `${"•".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function maskCpf(value?: string | null): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return "•••.•••.•••-••";
  return `•••.${digits.slice(3, 6)}.•••-${digits.slice(-2)}`;
}

export function maskPlate(value?: string | null): string {
  if (!value) return "—";
  const v = value.toUpperCase().replace(/\s/g, "");
  if (v.length < 4) return "•".repeat(v.length);
  return `${v.slice(0, 3)}•${v.slice(-2)}`;
}

export function maskName(value?: string | null): string {
  if (!value) return "—";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase() ?? ""}.`;
}
