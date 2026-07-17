import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  component: History,
});

function History() {
  const { user } = useAuth();
  const { data: items } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("appointments")
          .select("*")
          .eq("user_id", user!.id)
          .order("scheduled_at", { ascending: false })
      ).data ?? [],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Histórico</h1>
      {items?.length ? (
        items.map((a) => {
          const cfg =
            a.status === "completed"
              ? {
                  Icon: CheckCircle2,
                  cls: "bg-primary/15 text-primary border-primary/30",
                  label: "Concluída",
                }
              : a.status === "cancelled"
                ? {
                    Icon: XCircle,
                    cls: "bg-destructive/15 text-destructive border-destructive/40",
                    label: "Cancelada",
                  }
                : {
                    Icon: Clock,
                    cls: "bg-secondary text-foreground border-border",
                    label: "Agendada",
                  };
          const I = cfg.Icon;
          return (
            <Card
              key={a.id}
              className="flex items-center justify-between border-border/60 bg-card p-4"
            >
              <div>
                <div className="font-semibold">
                  {format(new Date(a.scheduled_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                </div>
                {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
              </div>
              <Badge className={`gap-1 border ${cfg.cls}`}>
                <I className="h-3.5 w-3.5" />
                {cfg.label}
              </Badge>
            </Card>
          );
        })
      ) : (
        <Card className="border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Nenhuma lavagem ainda.
        </Card>
      )}
    </div>
  );
}
