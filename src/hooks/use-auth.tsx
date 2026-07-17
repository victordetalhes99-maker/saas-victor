import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getClientPaymentsEnv } from "@/lib/payments-env";
import { getPublicEnv } from "@/lib/env.public";
import { hasAnyRole, STAFF_ROLES } from "@/lib/rbac";

const supabaseConfig = (() => {
  try {
    getPublicEnv();
    return { configured: true, message: null as string | null };
  } catch (error) {
    return {
      configured: false,
      message: error instanceof Error ? error.message : "Supabase não configurado.",
    };
  }
})();

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  roles: string[];
  rolesLoaded: boolean;
  profileStatus: string | null;
  hasActiveSubscription: boolean;
  subscriptionLoading: boolean;
  roleError: string | null;
  backendConfigured: boolean;
  backendMessage: string | null;
  refreshRole: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  roles: [],
  rolesLoaded: false,
  profileStatus: null,
  hasActiveSubscription: false,
  subscriptionLoading: true,
  roleError: null,
  backendConfigured: false,
  backendMessage: null,
  refreshRole: async () => {},
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseConfig.configured);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(supabaseConfig.configured);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadProfileStatus = async (userId?: string) => {
    if (!userId || !supabaseConfig.configured) {
      setProfileStatus(null);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();
      setProfileStatus((data as { status?: string } | null)?.status ?? null);
    } catch {
      setProfileStatus(null);
    }
  };

  const loadRole = async (userId?: string) => {
    if (!userId) {
      setIsAdmin(false);
      setRoles([]);
      setRolesLoaded(false);
      setRoleError(null);
      return;
    }

    if (!supabaseConfig.configured) {
      setIsAdmin(false);
      setRoles([]);
      setRolesLoaded(true);
      setRoleError(null);
      return;
    }

    try {
      const { data, error } = await (supabase as any).rpc("list_user_roles", {
        _user_id: userId,
      });

      if (error) {
        setIsAdmin(false);
        setRoles([]);
        setRolesLoaded(false);
        setRoleError(error.message);
        return;
      }

      const list = ((data ?? []) as Array<{ role: string }>).map((r) => String(r.role));
      setRoles(list);
      setIsAdmin(hasAnyRole(list, STAFF_ROLES));
      setRolesLoaded(true);
      setRoleError(null);
    } catch (error) {
      setIsAdmin(false);
      setRoles([]);
      setRolesLoaded(false);
      setRoleError(error instanceof Error ? error.message : "Não foi possível validar o acesso.");
    }
  };

  const loadSubscription = async (userId?: string) => {
    if (!userId) {
      setHasActiveSubscription(false);
      return;
    }
    if (!supabaseConfig.configured) {
      setHasActiveSubscription(false);
      return;
    }
    const env = getClientPaymentsEnv();
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status,current_period_end,environment")
        .eq("user_id", userId)
        .eq("environment", env)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setHasActiveSubscription(false);
        return;
      }
      if (!data) {
        setHasActiveSubscription(false);
        return;
      }
      // Treat as active if no period end set, or end is still in the future
      const stillValid =
        !data.current_period_end || new Date(data.current_period_end).getTime() > Date.now();
      setHasActiveSubscription(stillValid);
    } catch {
      setHasActiveSubscription(false);
    }
  };

  useEffect(() => {
    if (!supabaseConfig.configured) {
      setSession(null);
      setIsAdmin(false);
      setHasActiveSubscription(false);
      setRoleError(null);
      setLoading(false);
      setSubscriptionLoading(false);
      return;
    }

    let active = true;

    const finishSignedOut = () => {
      setSession(null);
      setIsAdmin(false);
      setRoles([]);
      setRolesLoaded(false);
      setHasActiveSubscription(false);
      setRoleError(null);
      setLoading(false);
      setSubscriptionLoading(false);
    };

    const hydrateAccount = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setLoading(true);
      setSubscriptionLoading(true);
      if (s?.user) {
        try {
          await Promise.all([
            loadRole(s.user.id),
            loadSubscription(s.user.id),
            loadProfileStatus(s.user.id),
          ]);
        } finally {
          if (active) {
            setLoading(false);
            setSubscriptionLoading(false);
          }
        }
      } else {
        finishSignedOut();
      }
    };

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const response = supabase.auth.onAuthStateChange((event, s) => {
        if (event === "TOKEN_REFRESHED") {
          setSession(s);
          return;
        }
        void hydrateAccount(s);
      });
      subscription = response.data.subscription;
      void supabase.auth
        .getSession()
        .then(({ data: { session: s } }) => hydrateAccount(s))
        .catch(() => finishSignedOut());
    } catch {
      finishSignedOut();
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Realtime: reflect profile.status changes (e.g. Stripe webhook flipping pending → active).
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !supabaseConfig.configured) return;
    const channel = supabase
      .channel(`profile-status:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { status?: string } | null)?.status ?? null;
          setProfileStatus(next);
          // Subscription may have flipped too — refresh it.
          void loadSubscription(userId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const refreshRole = async () => {
    if (!supabaseConfig.configured) return;
    setLoading(true);
    await loadRole(session?.user.id);
    setLoading(false);
  };

  const refreshSubscription = async () => {
    if (!supabaseConfig.configured) return;
    setSubscriptionLoading(true);
    await loadSubscription(session?.user.id);
    setSubscriptionLoading(false);
  };

  const signOut = async () => {
    if (!supabaseConfig.configured) return;
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        isAdmin,
        roles,
        rolesLoaded,
        profileStatus,
        hasActiveSubscription,
        subscriptionLoading,
        roleError,
        backendConfigured: supabaseConfig.configured,
        backendMessage: supabaseConfig.message,
        refreshRole,
        refreshSubscription,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
