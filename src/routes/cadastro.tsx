import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({
    meta: [{ title: "Cadastro — Clube Detail" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function CadastroPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (error) throw error;
      toast.success("Cadastro enviado.");
      if (data.session) {
        void navigate({ to: "/aguardando-aprovacao", replace: true });
      } else {
        void navigate({ to: "/login", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao cadastrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimplePage
      eyebrow="Cadastro"
      title="Criar novo acesso"
      description="Use o mesmo e-mail que recebeu aprovação ou convite."
      actions={[
        { label: "Já tenho conta", to: "/login", variant: "secondary" },
        { label: "Esqueci a senha", to: "/forgot-password", variant: "secondary" },
      ]}
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nome</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
            required
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
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
          {busy ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Já aprovou o cadastro?{" "}
        <Link to="/login" className="text-primary">
          Entre aqui
        </Link>
        .
      </p>
    </SimplePage>
  );
}
