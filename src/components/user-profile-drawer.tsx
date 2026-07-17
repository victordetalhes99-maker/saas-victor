import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  User as UserIcon,
  ShieldCheck,
  Settings,
  FileText,
  LogOut,
  ChevronRight,
} from "lucide-react";

type Item = {
  to: "/perfil" | "/conta" | "/configuracoes" | "/privacidade";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: Item[] = [
  {
    to: "/perfil",
    label: "Perfil",
    description: "Edite seus dados pessoais",
    icon: UserIcon,
  },
  {
    to: "/conta",
    label: "Conta",
    description: "Segurança e assinatura",
    icon: ShieldCheck,
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    description: "Preferências e notificações",
    icon: Settings,
  },
  {
    to: "/privacidade",
    label: "Privacidade & Termos",
    description: "Documentos legais",
    icon: FileText,
  },
];

export function UserProfileDrawer() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-drawer", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, email")
        .eq("id", user!.id)
        .maybeSingle();
      return data as {
        full_name: string | null;
        avatar_url: string | null;
        email: string | null;
      } | null;
    },
  });

  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? null;
  const email = profile?.email ?? user?.email ?? null;
  const avatarUrl = profile?.avatar_url ?? null;
  const initials = (fullName ?? email ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const go = (to: Item["to"]) => {
    setOpen(false);
    nav({ to });
  };

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    nav({ to: "/login", replace: true });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu do perfil"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Avatar className="h-9 w-9">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Perfil"} />}
            <AvatarFallback className="bg-primary/15 text-[11px] font-semibold uppercase tracking-wider text-primary">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[85vw] max-w-[420px] border-l border-white/[0.06] bg-card/85 p-0 backdrop-blur-2xl shadow-[var(--shadow-float)] sm:w-[420px]"
      >
        <div className="relative flex h-full flex-col">
          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />

          {/* Header — user identity */}
          <div className="relative px-6 pb-6 pt-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
              Minha conta
            </p>
            <div className="mt-4 flex items-center gap-3.5">
              <Avatar className="h-14 w-14 ring-1 ring-white/10">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Perfil"} />}
                <AvatarFallback className="bg-primary/15 text-base font-semibold uppercase tracking-wider text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="text-display truncate text-lg leading-tight text-foreground">
                  {fullName ?? "Membro Clube Detail"}
                </h2>
                {email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>}
              </div>
            </div>
          </div>

          <div className="pointer-events-none mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Menu items */}
          <nav className="relative flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {ITEMS.map(({ to, label, description, icon: Icon }) => (
                <li key={to}>
                  <button
                    type="button"
                    onClick={() => go(to)}
                    className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.985]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-primary transition-colors group-hover:border-primary/25 group-hover:bg-primary/10">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-tight text-foreground">
                        {label}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="relative border-t border-white/[0.06] p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 py-3 text-[13px] font-semibold tracking-tight text-destructive transition-all duration-200 hover:border-destructive/50 hover:bg-destructive/15 active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Sair da conta
            </button>
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
              Clube Detail · Member
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
