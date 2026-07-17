import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-edit", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", user!.id)
        .maybeSingle();
      return data as {
        full_name: string | null;
        phone: string | null;
        email: string | null;
      } | null;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile-edit"] });
      qc.invalidateQueries({ queryKey: ["profile-drawer"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    },
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
          Perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Edite seus dados pessoais.</p>
      </header>

      <section className="anim-rise anim-rise-1 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
            <UserIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
              Dados pessoais
            </p>
            <h2 className="text-display text-lg leading-tight text-foreground">
              Informações da conta
            </h2>
          </div>
        </div>

        <form
          className="relative mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="full_name"
              className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Nome completo
            </Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="phone"
              className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Telefone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              E-mail
            </Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled readOnly />
          </div>
          <Button
            type="submit"
            disabled={save.isPending}
            className="h-11 gap-2 rounded-2xl bg-primary px-6 text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </section>
    </div>
  );
}
