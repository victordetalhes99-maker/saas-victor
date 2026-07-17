import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
});

function AdminHomePage() {
  const { data } = useQuery({
    queryKey: ["admin-home-overview"],
    queryFn: async () => {
      const [clients, appts, plans] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase.from("plans").select("id", { count: "exact", head: true }),
      ]);
      return {
        clients: clients.count ?? 0,
        appointments: appts.count ?? 0,
        plans: plans.count ?? 0,
      };
    },
  });

  return (
    <SimplePage
      eyebrow="Admin"
      title="Visão geral"
      description="Acompanhe clientes, agenda e configurações operacionais."
      actions={[
        { label: "Abrir agenda", to: "/admin/agenda" },
        { label: "Configurações", to: "/admin/configuracoes", variant: "secondary" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Clientes" value={data?.clients ?? "—"} />
        <Stat label="Agendamentos" value={data?.appointments ?? "—"} />
        <Stat label="Planos" value={data?.plans ?? "—"} />
      </div>
      <Link to="/admin/usuarios" className="text-sm text-primary">
        Ir para gestão de clientes
      </Link>
    </SimplePage>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
