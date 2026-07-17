import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Users,
  Calendar,
  ShieldCheck,
  Activity,
  Building2,
  Lock,
  Bell,
  UserCog,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/configuracoes/geral")({
  component: GeralPage,
});

function GeralPage() {
  const { data } = useQuery({
    queryKey: ["config-geral-overview"],
    queryFn: async () => {
      const [clients, appts, staff, company] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .in("role", ["owner", "admin", "manager", "attendant"]),
        supabase
          .from("company_settings")
          .select("legal_name, trade_name, updated_at")
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        clients: clients.count ?? 0,
        appointments: appts.count ?? 0,
        staff: staff.count ?? 0,
        company: company.data,
      };
    },
  });

  const stats = [
    { label: "Clientes cadastrados", value: data?.clients ?? "—", icon: Users },
    { label: "Agendamentos totais", value: data?.appointments ?? "—", icon: Calendar },
    { label: "Acessos administrativos", value: data?.staff ?? "—", icon: ShieldCheck },
    { label: "Status do sistema", value: "Operacional", icon: Activity, accent: true },
  ];

  const shortcuts = [
    { to: "/admin/configuracoes/estabelecimento", label: "Editar empresa", icon: Building2 },
    { to: "/admin/configuracoes/seguranca", label: "Alterar senha", icon: Lock },
    { to: "/admin/agenda", label: "Abrir agenda", icon: Calendar },
    { to: "/admin/usuarios", label: "Gerenciar acessos", icon: UserCog },
    { to: "/admin/configuracoes/notificacoes", label: "Configurar notificações", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/10 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
              Empresa
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {data?.company?.trade_name || data?.company?.legal_name || "Clube Detail"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Última atualização:{" "}
              {data?.company?.updated_at
                ? new Date(data.company.updated_at).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-xs">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary">
              Versão 1.0
            </span>
            <span className="text-muted-foreground">Plano Interno</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon
                className={`h-4 w-4 ${s.accent ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
            <p className={`mt-2 text-2xl font-semibold ${s.accent ? "text-primary" : ""}`}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          Acesso rápido
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.05]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
