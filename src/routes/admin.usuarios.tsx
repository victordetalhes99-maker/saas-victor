import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { updateUserStaffRole, createInternalUser, deleteInternalUser } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  Trash2,
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Users,
  Crown,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// Página de gestão de acessos administrativos ("Gerenciar acessos").
// Antes desta correção este arquivo era um stub duplicado da tela de
// clientes (apontava para /admin/usuarios com o rótulo "Clientes"),
// enquanto a navegação principal também usava o mesmo caminho —
// deixando a página real de clientes (/admin/clientes, já completa)
// inacessível pelo menu, e os endpoints de gestão de acesso
// (updateUserStaffRole, createInternalUser, deleteInternalUser, já
// prontos e protegidos no servidor) sem nenhuma tela que os chamasse.
//
// A navegação de "Clientes" foi corrigida para apontar para
// /admin/clientes (ver src/routes/admin.tsx). Esta página passa a ser,
// de fato, a gestão de acessos administrativos (staff), como o link
// "Gerenciar acessos" em Configurações já sugeria.

export const Route = createFileRoute("/admin/usuarios")({
  component: StaffAccessPage,
});

type StaffRole = "admin" | "operator" | "manager" | "attendant";
const ROLE_LABEL: Record<"owner" | StaffRole, string> = {
  owner: "Owner",
  admin: "Administrador",
  operator: "Operador",
  manager: "Gerente",
  attendant: "Atendente",
};
const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  admin: "Gerencia operação, clientes, agenda e financeiro conforme as permissões existentes.",
  operator: "Acesso operacional à agenda e aos clientes, conforme as permissões existentes.",
  manager: "Acompanha operação e relatórios, conforme as permissões existentes.",
  attendant: "Acesso operacional limitado, conforme as permissões existentes.",
};
const ASSIGNABLE_ROLES: StaffRole[] = ["admin", "operator", "manager", "attendant"];

type StaffRow = {
  userId: string;
  role: "owner" | StaffRole;
  fullName: string;
  email: string | null;
  status: string;
};

async function fetchStaff(): Promise<StaffRow[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin", "operator", "manager", "attendant"]);
  if (rolesError) throw new Error(rolesError.message);
  if (!roles || roles.length === 0) return [];

  const userIds = [...new Set(roles.map((r) => r.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, status")
    .in("id", userIds);
  if (profilesError) throw new Error(profilesError.message);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return roles
    .map((r) => {
      const p = profileById.get(r.user_id);
      return {
        userId: r.user_id,
        role: r.role as StaffRow["role"],
        fullName: p?.full_name ?? "—",
        email: p?.email ?? null,
        status: p?.status ?? "unknown",
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function initialsOf(name?: string | null) {
  const clean = (name ?? "").trim();
  if (!clean || clean === "—") return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function StaffAccessPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateRoleFn = useServerFn(updateUserStaffRole);
  const createFn = useServerFn(createInternalUser);
  const deleteFn = useServerFn(deleteInternalUser);

  const {
    data: staff,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-staff-access"],
    queryFn: fetchStaff,
  });

  const [creating, setCreating] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "attendant" as StaffRole,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-staff-access"] });

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      await createFn({ data: form });
      toast.success("Acesso administrativo criado.");
      setForm({ email: "", fullName: "", password: "", role: "attendant" });
      await invalidate();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao criar acesso.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (userId: string, role: StaffRole) => {
    setBusyUserId(userId);
    try {
      await updateRoleFn({ data: { userId, role } });
      toast.success("Papel atualizado.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar papel.");
    } finally {
      setBusyUserId(null);
    }
  };

  const revoke = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await deleteFn({ data: { userId } });
      toast.success("Acesso revogado.");
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao revogar acesso.");
    } finally {
      setBusyUserId(null);
    }
  };

  const totalStaff = staff?.length ?? 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
                Configurações
              </p>
              <h1 className="text-display text-3xl tracking-tight text-foreground">
                Acessos administrativos
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                O Owner controla quem pode acessar o painel administrativo e qual permissão cada
                pessoa possui.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {totalStaff} {totalStaff === 1 ? "usuário" : "usuários"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Crown className="h-3.5 w-3.5" />
              Apenas o Owner gerencia acessos
            </span>
          </div>
        </div>

        {/* Create access card */}
        <Card className="rounded-3xl border-white/10 bg-card p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Criar novo acesso</h2>
              <p className="text-xs text-muted-foreground">
                Cria uma conta administrativa com senha provisória.
              </p>
            </div>
          </div>

          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWithIcon icon={User} label="Nome completo">
                <Input
                  placeholder="Nome da pessoa"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                  minLength={2}
                  className="border-white/10 bg-white/[0.03]"
                />
              </FieldWithIcon>
              <FieldWithIcon icon={Mail} label="E-mail">
                <Input
                  placeholder="pessoa@email.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="border-white/10 bg-white/[0.03]"
                />
              </FieldWithIcon>
              <FieldWithIcon icon={Lock} label="Senha provisória">
                <div className="relative">
                  <Input
                    placeholder="Mínimo 8 caracteres"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={8}
                    className="border-white/10 bg-white/[0.03] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </FieldWithIcon>
              <FieldWithIcon icon={ShieldCheck} label="Função">
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as StaffRole }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldWithIcon>
            </div>

            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
              <strong className="text-foreground">{ROLE_LABEL[form.role]}:</strong>{" "}
              {ROLE_DESCRIPTION[form.role]}
            </p>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}

            <Button
              type="submit"
              disabled={creating}
              className="h-11 gap-2 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Criar acesso
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Current access list */}
        <Card className="rounded-3xl border-white/10 bg-card p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Acessos atuais</h2>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <AlertCircle className="h-5 w-5 text-destructive-foreground" />
              <p className="text-sm text-destructive-foreground">
                Não foi possível carregar os acessos administrativos.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="mt-1 h-8 gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          )}

          {!isLoading && !isError && (!staff || staff.length === 0) && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
              <Users className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Nenhum acesso administrativo encontrado
              </p>
            </div>
          )}

          {!isLoading && !isError && staff && staff.length > 0 && (
            <div className="space-y-2">
              {staff.map((s) => {
                const isSelf = s.userId === user?.id;
                const isOwner = s.role === "owner";
                return (
                  <div
                    key={s.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-white/[0.12]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-white/10 ${
                          isOwner
                            ? "bg-primary/20 text-primary"
                            : "bg-white/[0.06] text-foreground/80"
                        }`}
                        aria-hidden
                      >
                        {initialsOf(s.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                          <span className="truncate">{s.fullName}</span>
                          {isSelf && (
                            <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              você
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.email ?? "sem e-mail"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          <Crown className="h-3 w-3" />
                          {ROLE_LABEL.owner}
                        </span>
                      ) : (
                        <Select
                          value={s.role}
                          onValueChange={(v) => changeRole(s.userId, v as StaffRole)}
                          disabled={busyUserId === s.userId || isSelf}
                        >
                          <SelectTrigger className="h-8 w-[150px] rounded-full border-white/10 bg-white/[0.03] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!isOwner && !isSelf && (
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={busyUserId === s.userId}
                                  aria-label={`Revogar acesso de ${s.fullName}`}
                                  className="h-8 w-8 rounded-full hover:bg-destructive/10"
                                >
                                  {busyUserId === s.userId ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Revogar acesso</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent className="rounded-2xl border-white/10 bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revogar acesso de {s.fullName}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A conta será removida e não poderá mais acessar o painel
                                administrativo. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revoke(s.userId)}
                                className="bg-rose-500 text-white hover:bg-rose-500/90"
                              >
                                Revogar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}

function FieldWithIcon({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      {children}
    </div>
  );
}
