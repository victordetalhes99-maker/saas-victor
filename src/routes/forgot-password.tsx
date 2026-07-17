import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      if (error) throw error;
      toast.success("E-mail enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar e-mail.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimplePage
      eyebrow="Senha"
      title="Recuperar acesso"
      description="Enviaremos um link de redefinição para o e-mail informado."
      actions={[{ label: "Voltar ao login", to: "/login", variant: "secondary" }]}
    >
      <form onSubmit={submit} className="space-y-3">
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
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </SimplePage>
  );
}
