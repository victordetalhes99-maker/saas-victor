import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada.");
      void navigate({ to: "/login", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimplePage
      eyebrow="Senha"
      title="Definir nova senha"
      description="Use este formulário após abrir o link de recuperação."
      actions={[{ label: "Ir para login", to: "/login", variant: "secondary" }]}
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Nova senha
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Confirmar
          </span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </SimplePage>
  );
}
