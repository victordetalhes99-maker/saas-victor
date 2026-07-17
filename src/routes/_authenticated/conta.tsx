import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ShieldCheck, KeyRound, CreditCard, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/conta")({
  component: ContaPage,
});

function ContaPage() {
  const { user } = useAuth();

  const { data: sub } = useQuery({
    queryKey: ["sub-conta", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (
        await supabase
          .from("subscriptions")
          .select("*, plans(name)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  return (
    <div className="space-y-6 pb-8">
      <header className="anim-rise pt-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="mt-2 text-display text-[34px] leading-[1.05] sm:text-[42px] text-gradient">
          Conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Segurança e assinatura.</p>
      </header>

      <section className="anim-rise anim-rise-1 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
              Assinatura
            </p>
            <h2 className="text-display text-lg leading-tight text-foreground">
              {sub?.plans?.name ?? "Sem plano ativo"}
            </h2>
          </div>
        </div>
        <div className="relative mt-5 grid gap-2.5 sm:grid-cols-2">
          <InfoRow label="Status" value={sub?.status ?? "—"} />
          <InfoRow
            label="Renovação"
            value={
              sub?.current_period_end
                ? format(new Date(sub.current_period_end), "dd MMM yyyy", { locale: ptBR })
                : "—"
            }
          />
        </div>
        <Link
          to="/planos"
          className="relative mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition hover:border-primary/25 hover:bg-primary/5"
        >
          <span className="text-sm text-foreground">Alterar plano</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      <section className="anim-rise anim-rise-2 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
              Segurança
            </p>
            <h2 className="text-display text-lg leading-tight text-foreground">Acesso e senha</h2>
          </div>
        </div>
        <div className="relative mt-5 space-y-2.5">
          <InfoRow label="E-mail" value={user?.email ?? "—"} />
          <button
            type="button"
            onClick={async () => {
              if (!user?.email) return;
              await supabase.auth.resetPasswordForEmail(user.email);
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left transition hover:border-primary/25 hover:bg-primary/5"
          >
            <span className="flex items-center gap-2 text-sm text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              Redefinir senha por e-mail
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <div className="text-[9px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
        {label}
      </div>
      <div className="mt-1.5 truncate text-[14px] font-semibold text-foreground">{value}</div>
    </div>
  );
}
