import { describe, it, expect } from "vitest";
import {
  STAFF_ROLES,
  ADMIN_ROLES,
  isStaffRole,
  isAdminRole,
  hasAnyRole,
  primaryRole,
} from "./rbac";

describe("rbac", () => {
  describe("isStaffRole", () => {
    it("recognizes every staff role", () => {
      for (const role of STAFF_ROLES) {
        expect(isStaffRole(role)).toBe(true);
      }
    });

    it("rejects the client role", () => {
      expect(isStaffRole("client")).toBe(false);
    });

    it("rejects null, undefined and unknown strings", () => {
      expect(isStaffRole(null)).toBe(false);
      expect(isStaffRole(undefined)).toBe(false);
      expect(isStaffRole("hacker")).toBe(false);
      expect(isStaffRole("")).toBe(false);
    });
  });

  describe("isAdminRole", () => {
    it("recognizes owner and admin only", () => {
      for (const role of ADMIN_ROLES) {
        expect(isAdminRole(role)).toBe(true);
      }
    });

    it("does not treat operator/manager/attendant as admin", () => {
      expect(isAdminRole("operator")).toBe(false);
      expect(isAdminRole("manager")).toBe(false);
      expect(isAdminRole("attendant")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("returns true when the user has at least one allowed role", () => {
      expect(hasAnyRole(["client", "owner"], STAFF_ROLES)).toBe(true);
    });

    it("returns false when the user has none of the allowed roles", () => {
      expect(hasAnyRole(["client"], STAFF_ROLES)).toBe(false);
    });

    it("returns false for an empty role list — a user with no rows in", () => {
      // user_roles must never be treated as staff.
      expect(hasAnyRole([], STAFF_ROLES)).toBe(false);
    });
  });

  describe("primaryRole", () => {
    it("prioritizes owner over every other role", () => {
      expect(primaryRole(["attendant", "owner", "client"])).toBe("owner");
    });

    it("falls back through the staff hierarchy in order", () => {
      expect(primaryRole(["attendant", "manager"])).toBe("manager");
      expect(primaryRole(["attendant"])).toBe("attendant");
    });

    it("returns client when only the client role is present", () => {
      expect(primaryRole(["client"])).toBe("client");
    });

    it("returns null when there are no roles at all", () => {
      expect(primaryRole([])).toBeNull();
    });
  });
});
