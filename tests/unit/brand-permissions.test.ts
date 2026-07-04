import { describe, expect, it } from "vitest";
import {
  canChangeBrandRoles,
  canManageBrandContent,
  canManageContributors,
  isBrandRole,
} from "@/lib/brands/types";

describe("brand role capabilities", () => {
  it("keeps the fixed role vocabulary closed", () => {
    expect(isBrandRole("owner")).toBe(true);
    expect(isBrandRole("admin")).toBe(true);
    expect(isBrandRole("contributor")).toBe(true);
    expect(isBrandRole("poster")).toBe(false);
  });

  it("allows only owner and admin to manage all brand content", () => {
    expect(canManageBrandContent("owner")).toBe(true);
    expect(canManageBrandContent("admin")).toBe(true);
    expect(canManageBrandContent("contributor")).toBe(false);
    expect(canManageBrandContent(null)).toBe(false);
  });

  it("protects role changes as an owner-only capability", () => {
    expect(canManageContributors("owner")).toBe(true);
    expect(canManageContributors("admin")).toBe(true);
    expect(canManageContributors("contributor")).toBe(false);
    expect(canChangeBrandRoles("owner")).toBe(true);
    expect(canChangeBrandRoles("admin")).toBe(false);
  });
});
