import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { updateAdminProfile } from "@/lib/config.functions";
import { useAuth } from "@/hooks/use-auth";
import { AvatarUploader } from "@/components/avatar-uploader";

export const Route = createFileRoute("/admin/configuracoes/administrador")({
  component: AdminProfilePage,
});

type Profile = {
  full_name: string;
  display_name: string;
  phone: string;
  job_title: string;
  avatar_url: string;
  email: string;
};

const EMPTY: Profile = {
  full_name: "",
  display_name: "",
  phone: "",
  job_title: "",
  avatar_url: "",
  email: "",
};

function AdminProfilePage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["config-admin-profile", user?.id],
    queryFn: async (): Promise<Profile> => {
      if (!user) return EMPTY;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, display_name, phone, job_title, avatar_url, email")
        .eq("id", user.id)
        .maybeSingle();
      const p = (data ?? {}) as Partial<Profile>;
      return {
        full_name: p.full_name ?? "",
        display_name: p.display_name ?? "",
        phone: p.phone ?? "",
        job_title: p.job_title ?? "",
        avatar_url: p.avatar_url ?? "",
        email: p.email ?? user.email ?? "",
      };
    },
    enabled: !!user,
  });

  const [form, setForm] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(data ?? EMPTY), [form, data]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.full_name.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setSaving(true);
    try {
      await updateAdminProfile({
        data: {
          full_name: form.full_name.trim(),
          display_name: form.display_name.trim() || null,
          phone: form.phone.trim() || null,
          job_title: form.job_title.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
        },
      });
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["config-admin-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
    );
  }

  const initials = (form.display_name || form.full_name || form.email || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="mb-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {form.display_name || form.full_name || "Seu perfil"}
            </h2>
            <p className="text-xs text-muted-foreground">{form.email}</p>
          </div>
          {user && (
            <AvatarUploader
              userId={user.id}
              value={form.avatar_url}
              initials={initials}
              onChange={(v) => {
                set("avatar_url", v);
                qc.invalidateQueries({ queryKey: ["config-admin-profile"] });
              }}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo">
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Nome de exibição">
            <Input
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              maxLength={80}
              placeholder="Como aparece no app"
            />
          </Field>
          <Field label="Cargo">
            <Input
              value={form.job_title}
              onChange={(e) => set("job_title", e.target.value)}
              maxLength={80}
              placeholder="Ex.: Sócio, Gerente"
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              maxLength={30}
            />
          </Field>
          <Field label="E-mail" className="sm:col-span-2">
            <Input value={form.email} disabled />
            <p className="text-[11px] text-muted-foreground">
              Alterar e-mail exige verificação — disponível em breve.
            </p>
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur-xl">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Alterações não salvas." : "Nenhuma alteração pendente."}
        </p>
        <Button
          onClick={submit}
          disabled={!dirty || saving}
          className="rounded-full bg-primary text-primary-foreground"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
