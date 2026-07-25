import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SimplePage } from "@/components/simple-page";
import { validateInvite, acceptInvite } from "@/lib/invites.functions";

// Página de ativação de convite. Todo convite gerado (por admin ou após
// checkout do Stripe) envia um e-mail apontando para
// `${APP_URL}/ativar?token=...` (ver src/lib/invites.server.ts e
// src/lib/invites.functions.ts). Antes desta correção essa rota não
// existia — o link do e-mail levava a uma tela 404, e nada no frontend
// chamava `validateInvite`/`acceptInvite`, tornando o fluxo de ativação
// de clientes convidados completamente inacessível.
export const Route = createFileRoute("/ativar")({
  component: AtivarPage,
  head: () => ({
    meta: [
      { title: "Ativar conta — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type InviteState =
  | { status: "loading" }
  | { status: "invalid"; reason: string }
  | { status: "ready"; email: string; fullName: string | null; planName: string | null };

function getTokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

function reasonMessage(error: string): string {
  switch (error) {
    case "used":
      return "Este convite já foi utilizado.";
    case "expired":
      return "Este convite expirou. Solicite um novo link à administração.";
    case "revoked":
      return "Este convite foi cancelado.";
    default:
      return "Link de ativação inválido ou expirado.";
  }
}

function AtivarPage() {
  const navigate = useNavigate();
  const [token] = useState(getTokenFromLocation);
  const [invite, setInvite] = useState<InviteState>({ status: "loading" });
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setInvite({ status: "invalid", reason: reasonMessage("missing") });
      return;
    }
    (async () => {
      try {
        const result = await validateInvite({ data: { token } });
        if (cancelled) return;
        if (!result.ok) {
          setInvite({ status: "invalid", reason: reasonMessage(result.error) });
          return;
        }
        setFullName(result.fullName ?? "");
        setInvite({
          status: "ready",
          email: result.email,
          fullName: result.fullName,
          planName: result.planName,
        });
      } catch {
        if (!cancelled) setInvite({ status: "invalid", reason: reasonMessage("invalid") });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const result = await acceptInvite({
        data: { token, password, fullName: fullName.trim() || undefined },
      });
      if (!result.ok) {
        toast.error(reasonMessage(result.error));
        return;
      }
      toast.success("Conta ativada. Faça login para continuar.");
      void navigate({ to: "/login", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ativar a conta.");
    } finally {
      setBusy(false);
    }
  };

  if (invite.status === "loading") {
    return (
      <SimplePage eyebrow="Ativação" title="Verificando convite...">
        <p className="text-sm text-muted-foreground">Aguarde um instante.</p>
      </SimplePage>
    );
  }

  if (invite.status === "invalid") {
    return (
      <SimplePage
        eyebrow="Ativação"
        title="Não foi possível ativar"
        description={invite.reason}
        actions={[{ label: "Ir para login", to: "/login", variant: "secondary" }]}
      />
    );
  }

  return (
    <SimplePage
      eyebrow="Ativação"
      title="Ative sua conta"
      description={
        invite.planName
          ? `Convite para ${invite.email} — plano ${invite.planName}. Defina seu nome e senha para concluir.`
          : `Convite para ${invite.email}. Defina seu nome e senha para concluir.`
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nome</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            required
            minLength={2}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Senha</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Confirmar senha
          </span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            required
            minLength={8}
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          {busy ? "Ativando..." : "Ativar conta"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Já ativou?{" "}
        <Link to="/login" className="text-primary">
          Entre aqui
        </Link>
        .
      </p>
    </SimplePage>
  );
}
