export const STAFF_ROLES = ["owner", "admin", "operator", "manager", "attendant"] as const;
export const ADMIN_ROLES = ["owner", "admin"] as const;
export const CLIENT_ROLES = ["client"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function hasAnyRole(roles: string[], allowed: readonly string[]) {
  return roles.some((role) => allowed.includes(role));
}

export function primaryRole(roles: string[]) {
  const priority: StaffRole[] = ["owner", "admin", "operator", "manager", "attendant"];
  const found = priority.find((role) => roles.includes(role));
  return found ?? (roles.includes("client") ? "client" : null);
}
