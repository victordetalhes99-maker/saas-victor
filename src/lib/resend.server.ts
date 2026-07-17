import { getServerEnv, requireServerFeature } from "./env.server";

const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

export async function sendResendEmail({ to, subject, html, from, replyTo, tags }: SendEmailInput) {
  const env = requireServerFeature(["RESEND_API_KEY", "EMAIL_FROM"], "Transactional email");
  const reply = replyTo ?? getServerEnv().EMAIL_REPLY_TO;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from ?? env.EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      reply_to: reply ? [reply] : undefined,
      subject,
      html,
      tags,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Resend request failed with status ${res.status}`);
  }

  try {
    return JSON.parse(body) as { id?: string };
  } catch {
    return { id: undefined };
  }
}

const BRAND = {
  bg: "#0a0a0f",
  card: "#11111a",
  text: "#e5e7eb",
  muted: "#9ca3af",
  primary: "#22c55e",
};

function wrap(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:${BRAND.bg};font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:${BRAND.text}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid #1f2937;border-radius:16px;padding:32px">
        ${inner}
        <tr><td style="padding-top:24px;border-top:1px solid #1f2937;color:${BRAND.muted};font-size:12px;text-align:center">
          Esta mensagem foi enviada automaticamente por ${getServerEnv().APP_NAME}.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export function inviteEmailHtml(opts: {
  fullName?: string;
  activationUrl: string;
  planName?: string;
}) {
  const name = opts.fullName ? `, ${opts.fullName.split(" ")[0]}` : "";
  const plan = opts.planName
    ? `<p style="color:${BRAND.muted};margin:0 0 16px">Plano: <strong style="color:${BRAND.text}">${opts.planName}</strong></p>`
    : "";
  return wrap(`
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:22px">Bem-vindo ao ${getServerEnv().APP_NAME}${name}</h1>
      <p style="color:${BRAND.muted};margin:0 0 20px">Seu pagamento foi confirmado. Para ativar sua conta e começar a agendar seus atendimentos, defina sua senha.</p>
      ${plan}
      <p style="margin:24px 0"><a href="${opts.activationUrl}" style="display:inline-block;background:${BRAND.primary};color:#04130b;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">Ativar minha conta</a></p>
      <p style="color:${BRAND.muted};font-size:13px;margin:0">Este link expira em <strong>48 horas</strong> e só pode ser usado uma vez.</p>
      <p style="color:${BRAND.muted};font-size:12px;margin:16px 0 0;word-break:break-all">Se o botão não funcionar: ${opts.activationUrl}</p>
    </td></tr>
  `);
}

export function subscriptionActivatedHtml(opts: {
  fullName?: string;
  planName?: string;
  appUrl: string;
}) {
  const name = opts.fullName ? `, ${opts.fullName.split(" ")[0]}` : "";
  const plan = opts.planName
    ? `<p style="color:${BRAND.muted};margin:0 0 16px">Plano: <strong style="color:${BRAND.text}">${opts.planName}</strong></p>`
    : "";
  return wrap(`
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:22px">Assinatura ativa${name}</h1>
      <p style="color:${BRAND.muted};margin:0 0 20px">Seu acesso está liberado. Você já pode entrar na área do cliente e agendar seu próximo atendimento.</p>
      ${plan}
      <p style="margin:24px 0"><a href="${opts.appUrl}/dashboard" style="display:inline-block;background:${BRAND.primary};color:#04130b;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">Acessar minha área</a></p>
    </td></tr>
  `);
}

export function paymentStatusEmailHtml(opts: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:24px 0"><a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#04130b;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">${opts.ctaLabel}</a></p>`
      : "";
  return wrap(`
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:22px">${opts.title}</h1>
      <p style="color:${BRAND.muted};margin:0 0 20px">${opts.body}</p>
      ${cta}
    </td></tr>
  `);
}
