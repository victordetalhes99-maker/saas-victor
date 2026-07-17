import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Entrar — Clube Detail" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading, backendConfigured, backendMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!backendConfigured) {
      toast.error(backendMessage ?? "Backend não configurado.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.user) throw error ?? new Error("auth_failed");

      const { data: roles } = await (supabase as any).rpc("list_user_roles", {
        _user_id: data.user.id,
      });
      const roleNames = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
      const target =
        roleNames.includes("admin") || roleNames.includes("owner") ? "/admin" : "/dashboard";
      toast.success("Login realizado.");
      void navigate({ to: target, replace: true });
    } catch {
      toast.error("E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimplePage
      eyebrow="Acesso"
      title="Entrar na área do cliente"
      description="Acesse sua conta com o e-mail cadastrado."
      actions={[
        { label: "Criar conta", to: "/cadastro", variant: "secondary" },
        { label: "Admin", to: "/admin-login", variant: "secondary" },
      ]}
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">E-mail</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
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
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          {busy ? "Entrando..." : "Entrar"}
        </button>
        <div className="sm:col-span-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <Link to="/forgot-password" className="text-primary">
            Esqueci minha senha
          </Link>
          <span>•</span>
          <Link to="/cadastro" className="text-primary">
            Criar acesso
          </Link>
        </div>
      </form>
    </SimplePage>
  );
}
