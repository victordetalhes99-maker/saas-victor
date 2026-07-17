import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createStripeCheckout } from "@/lib/stripe.functions";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosClientePage,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PlanosClientePage() {
  const checkout = useServerFn(createStripeCheckout);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["client-plans"],
    queryFn: async () =>
      (
        await supabase
          .from("plans")
          .select("id, name, benefits, monthly_price, washes_per_month, stripe_price_id, active")
          .eq("active", true)
          .order("monthly_price")
      ).data ?? [],
  });

  const onSubscribe = async (planId: string) => {
    try {
      setLoadingId(planId);
      const res = await checkout({ data: { planId } });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error("Não foi possível iniciar o checkout.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar o checkout.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
          Assinatura
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Escolha seu plano</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Pagamento seguro via Stripe. Ambiente de testes ativo — nenhuma cobrança real será
          efetuada.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(plans ?? []).map((p: any) => {
          const disabled = !p.stripe_price_id || loadingId === p.id;
          return (
            <Card key={p.id} className="rounded-[20px] border-white/10 bg-card p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{fmtBRL(Number(p.monthly_price))}</span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.washes_per_month} lavagens/mês
              </p>
              {p.benefits?.length ? (
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {p.benefits.map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button
                onClick={() => onSubscribe(p.id)}
                disabled={disabled}
                className="mt-5 w-full rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90"
              >
                {loadingId === p.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecionando…
                  </>
                ) : (
                  "Assinar"
                )}
              </Button>
              {!p.stripe_price_id && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Em breve disponível.
                </p>
              )}
            </Card>
          );
        })}
        {!plans?.length && (
          <Card className="col-span-full rounded-2xl border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
            Nenhum plano disponível no momento.
          </Card>
        )}
      </div>
    </div>
  );
}
