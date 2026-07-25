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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";

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

function StaffAccessPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateRoleFn = useServerFn(updateUserStaffRole);
  const createFn = useServerFn(createInternalUser);
  const deleteFn = useServerFn(deleteInternalUser);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["admin-staff-access"],
    queryFn: fetchStaff,
  });

  const [creating, setCreating] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "attendant" as StaffRole,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-staff-access"] });

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      await createFn({ data: form });
      toast.success("Acesso administrativo criado.");
      setForm({ email: "", fullName: "", password: "", role: "attendant" });
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar acesso.");
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
          Configurações
        </p>
        <h1 className="text-display text-3xl tracking-tight text-foreground">
          Acessos administrativos
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gerencie quem tem acesso ao painel administrativo e com qual papel. Apenas o Owner pode
          criar, alterar ou revogar acessos.
        </p>
      </div>

      <Card className="rounded-3xl border-white/10 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Criar novo acesso</h2>
        </div>
        <form onSubmit={submitCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Nome completo"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            required
            minLength={2}
          />
          <Input
            placeholder="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            placeholder="Senha provisória"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
          />
          <div className="flex gap-2">
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v as StaffRole }))}
            >
              <SelectTrigger>
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
            <Button type="submit" disabled={creating}>
              {creating ? "Criando..." : "Criar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Acessos atuais</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !staff || staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso administrativo encontrado.</p>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => {
              const isSelf = s.userId === user?.id;
              const isOwner = s.role === "owner";
              return (
                <div
                  key={s.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {s.fullName} {isSelf && <span className="text-muted-foreground">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.email ?? "sem e-mail"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {ROLE_LABEL.owner}
                      </span>
                    ) : (
                      <Select
                        value={s.role}
                        onValueChange={(v) => changeRole(s.userId, v as StaffRole)}
                        disabled={busyUserId === s.userId || isSelf}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs">
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
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busyUserId === s.userId}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar acesso de {s.fullName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A conta será removida e não poderá mais acessar o painel
                              administrativo. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revoke(s.userId)}>
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
  );
}
