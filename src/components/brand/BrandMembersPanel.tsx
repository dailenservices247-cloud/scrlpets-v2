"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  addBrandMember,
  changeBrandMemberRole,
  removeBrandMember,
} from "@/lib/brands/actions";
import {
  BRAND_ROLE_OPTIONS,
  canChangeBrandRoles,
  canManageContributors,
  type BrandRole,
} from "@/lib/brands/types";
import type { BrandMember } from "@/lib/brands/queries";
import { capture } from "@/lib/analytics";

function errorKey(error: string): string {
  const keys = [
    "profile_not_found",
    "duplicate_member",
    "invalid_role",
    "owner_protected",
    "brand_permission_denied",
    "membership_not_found",
    "required",
  ];
  return keys.find((key) => error.includes(key)) ?? "unknown";
}

export function BrandMembersPanel({
  brandId,
  viewerId,
  viewerRole,
  members,
}: {
  brandId: string;
  viewerId: string;
  viewerRole: BrandRole;
  members: BrandMember[];
}) {
  const t = useTranslations("brandAccess");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [newRole, setNewRole] = useState<Exclude<BrandRole, "owner">>(
    "contributor",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canAdd = canManageContributors(viewerRole);

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("brandId", brandId);
    formData.set("username", username);
    formData.set(
      "role",
      viewerRole === "admin" ? "contributor" : newRole,
    );
    const result = await addBrandMember(formData);
    setBusy(null);
    if (!result.ok) {
      setError(errorKey(result.error));
      return;
    }
    capture("brand_member_added", {
      role: viewerRole === "admin" ? "contributor" : newRole,
    });
    setUsername("");
    setSuccess("added");
    router.refresh();
  }

  async function changeRole(
    membershipId: string,
    role: Exclude<BrandRole, "owner">,
  ) {
    setBusy(membershipId);
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("membershipId", membershipId);
    formData.set("role", role);
    const result = await changeBrandMemberRole(formData);
    setBusy(null);
    if (!result.ok) {
      setError(errorKey(result.error));
      return;
    }
    capture("brand_member_role_changed", { role });
    setSuccess("roleChanged");
    router.refresh();
  }

  async function removeMember(member: BrandMember) {
    setBusy(member.membershipId);
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("membershipId", member.membershipId);
    const result = await removeBrandMember(formData);
    setBusy(null);
    if (!result.ok) {
      setError(errorKey(result.error));
      return;
    }
    capture("brand_member_removed", { role: member.role });
    setSuccess(member.profileId === viewerId ? "left" : "removed");
    if (member.profileId === viewerId) {
      router.push("/brand-os");
    }
    router.refresh();
  }

  return (
    <section
      className="premium-panel rounded-2xl p-4"
      data-testid="brand-members-panel"
    >
      <p className="eyebrow">{t("label")}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("yourRole", { role: t(`roles.${viewerRole}`) })}
          </p>
        </div>
        <span className="rounded-full border border-secondary/40 bg-secondary/20 px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {t(`roles.${viewerRole}`)}
        </span>
      </div>

      {canAdd && (
        <form
          onSubmit={addMember}
          className="mt-5 rounded-xl border border-border/70 bg-muted/25 p-3"
          data-testid="brand-member-add-form"
        >
          <h3 className="font-semibold">{t("addTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("addBody")}
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t("username")}
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-input bg-transparent p-2"
              autoComplete="off"
              data-testid="brand-member-username"
            />
          </label>
          {viewerRole === "owner" && (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                {t("role")}
              </span>
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(
                    event.target.value as Exclude<BrandRole, "owner">,
                  )
                }
                className="w-full rounded-lg border border-input bg-background p-2"
                data-testid="brand-member-role"
              >
                {BRAND_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`roles.${option.value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={busy !== null || !username.trim()}
            className="mt-3 min-h-11 w-full rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground disabled:opacity-50"
            data-testid="brand-member-add"
          >
            {busy === "add" ? t("adding") : t("add")}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {success && (
        <p className="mt-3 text-sm text-secondary-foreground" role="status">
          {t(`success.${success}`)}
        </p>
      )}

      <ul className="mt-5 space-y-3" data-testid="brand-member-list">
        {members.map((member) => {
          const isSelf = member.profileId === viewerId;
          const ownerProtected = member.role === "owner";
          const ownerCanChange =
            canChangeBrandRoles(viewerRole) && !ownerProtected;
          const canRemove =
            !ownerProtected &&
            (isSelf ||
              viewerRole === "owner" ||
              (viewerRole === "admin" && member.role === "contributor"));

          return (
            <li
              key={member.membershipId}
              className="rounded-xl border border-border/70 bg-muted/25 p-3"
              data-testid={`brand-member-${member.profileId}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {member.displayName ?? member.username}
                    {isSelf ? ` ${t("you")}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{member.username}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-xs">
                  {t(`roles.${member.role}`)}
                </span>
              </div>

              {ownerProtected && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("ownerProtected")}
                </p>
              )}

              {ownerCanChange && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {BRAND_ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={
                        busy !== null || member.role === option.value
                      }
                      onClick={() =>
                        changeRole(member.membershipId, option.value)
                      }
                      className="rounded-lg border border-input px-3 py-2 text-xs font-medium text-brand-link disabled:opacity-45"
                      data-testid={`set-role-${option.value}-${member.membershipId}`}
                    >
                      {t("setRole", { role: t(`roles.${option.value}`) })}
                    </button>
                  ))}
                </div>
              )}

              {canRemove && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => removeMember(member)}
                  className="mt-3 rounded-lg border border-red-400/50 bg-red-950/70 px-3 py-2 text-xs font-medium text-red-200 disabled:opacity-50"
                  data-testid={`remove-member-${member.membershipId}`}
                >
                  {isSelf ? t("leave") : t("remove")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
