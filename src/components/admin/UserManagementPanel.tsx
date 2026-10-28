"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
  Shield,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { suspendAccount, reactivateAccount, togglePlatformRole } from "@/lib/admin/actions";
import type { AdminUserRow } from "@/lib/admin/queries";

export function UserManagementPanel({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const router = useRouter();
  const users = initialUsers;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dialog states
  const [activeDialog, setActiveDialog] = useState<{
    type: "suspend" | "reactivate" | "role";
    user: AdminUserRow | null;
    roleTarget?: "admin" | "moderator";
    roleGrant?: boolean;
  } | null>(null);

  const [reasonInput, setReasonInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredUsers = users.filter((u) => {
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = u.displayName?.toLowerCase().includes(q);
      const matchUser = u.username?.toLowerCase().includes(q);
      const matchId = u.id.toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchId) return false;
    }
    return true;
  });

  async function handleSuspend() {
    if (!activeDialog?.user?.username) return;
    if (reasonInput.trim().length < 4) {
      setActionError("Reason must be at least 4 characters long");
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await suspendAccount(activeDialog.user.username, reasonInput.trim());
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setActiveDialog(null);
    setReasonInput("");
    router.refresh();
  }

  async function handleReactivate() {
    if (!activeDialog?.user?.id) return;
    if (reasonInput.trim().length < 4) {
      setActionError("Reason must be at least 4 characters long");
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await reactivateAccount(activeDialog.user.id, reasonInput.trim());
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setActiveDialog(null);
    setReasonInput("");
    router.refresh();
  }

  async function handleToggleRole() {
    if (!activeDialog?.user?.id || !activeDialog.roleTarget) return;
    setBusy(true);
    setActionError(null);
    const res = await togglePlatformRole(
      activeDialog.user.id,
      activeDialog.roleTarget,
      activeDialog.roleGrant ?? true,
    );
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setActiveDialog(null);
    router.refresh();
  }

  return (
    <div className="space-y-4" data-testid="admin-users-panel">
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, display name, or UUID…"
            className="w-full rounded-xl border border-border/80 bg-background/80 py-2 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="inline-flex rounded-xl border border-border/70 bg-card/60 p-0.5 text-xs">
            {(["all", "active", "suspended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-micro font-medium uppercase transition",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Role filter */}
          <div className="inline-flex rounded-xl border border-border/70 bg-card/60 p-0.5 text-xs">
            {(["all", "admin", "moderator", "breeder", "transporter"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-micro font-medium capitalize transition",
                  roleFilter === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Count Banner */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>Showing {filteredUsers.length} user accounts</p>
      </div>

      {/* Users List / Table */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/40">
        <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-2">
          <div className="sm:col-span-4">USER ACCOUNT</div>
          <div className="sm:col-span-3">ROLES & CREDENTIALS</div>
          <div className="sm:col-span-2">STATUS</div>
          <div className="sm:col-span-3 text-right">OPERATIONS</div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No users match the selected query and filters.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredUsers.map((u) => {
              const isAdmin = u.roles.includes("admin");
              const isModerator = u.roles.includes("moderator");
              const isSuspended = u.status === "suspended";

              return (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 p-4 transition sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 hover:bg-muted/30"
                >
                  {/* User Profile Info */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="size-9 rounded-full object-cover border border-border/60"
                        />
                      ) : (
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-brand-link">
                          {(u.displayName || u.username || "U").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {u.displayName || u.username || "Anonymous"}
                          </p>
                          {u.username && (
                            <Link
                              href={`/u/${u.username}`}
                              target="_blank"
                              className="text-muted-foreground hover:text-brand-link"
                              title="View Public Profile"
                            >
                              <ExternalLink className="size-3" aria-hidden />
                            </Link>
                          )}
                        </div>
                        <p className="truncate font-mono text-micro text-muted-foreground">
                          @{u.username ?? "no-handle"}
                        </p>
                        <button
                          onClick={() => copyId(u.id)}
                          className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                          title="Click to copy UUID"
                        >
                          <span className="truncate max-w-[120px]">{u.id}</span>
                          {copiedId === u.id ? (
                            <Check className="size-2.5 text-emerald-500" aria-hidden />
                          ) : (
                            <Copy className="size-2.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Roles & Credentials */}
                  <div className="sm:col-span-3">
                    <div className="flex flex-wrap gap-1">
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-link">
                          <Shield className="size-2.5" aria-hidden />
                          ADMIN
                        </span>
                      )}
                      {isModerator && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                          MOD
                        </span>
                      )}
                      {u.roles.includes("breeder") && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-micro font-medium text-blue-600 dark:text-blue-400">
                          Breeder
                        </span>
                      )}
                      {u.roles.includes("transporter") && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-micro font-medium text-cyan-600 dark:text-cyan-400">
                          Transporter
                        </span>
                      )}
                      {u.roles.length === 0 && (
                        <span className="text-micro text-muted-foreground">Member</span>
                      )}
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="sm:col-span-2">
                    {isSuspended ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-destructive">
                        <UserX className="size-3" aria-hidden />
                        SUSPENDED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" aria-hidden />
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Actions Dropdown / Buttons */}
                  <div className="sm:col-span-3 sm:text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* Suspend or Reactivate */}
                      {isSuspended ? (
                        <button
                          onClick={() => {
                            setActionError(null);
                            setReasonInput("");
                            setActiveDialog({ type: "reactivate", user: u });
                          }}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-micro font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActionError(null);
                            setReasonInput("");
                            setActiveDialog({ type: "suspend", user: u });
                          }}
                          className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-micro font-semibold text-destructive transition hover:bg-destructive/20"
                        >
                          Suspend
                        </button>
                      )}

                      {/* Admin Toggle */}
                      <button
                        onClick={() => {
                          setActionError(null);
                          setActiveDialog({
                            type: "role",
                            user: u,
                            roleTarget: "admin",
                            roleGrant: !isAdmin,
                          });
                        }}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-micro font-mono transition",
                          isAdmin
                            ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                            : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        title={isAdmin ? "Revoke Admin Role" : "Grant Admin Role"}
                      >
                        {isAdmin ? "-Admin" : "+Admin"}
                      </button>

                      {/* Moderator Toggle */}
                      <button
                        onClick={() => {
                          setActionError(null);
                          setActiveDialog({
                            type: "role",
                            user: u,
                            roleTarget: "moderator",
                            roleGrant: !isModerator,
                          });
                        }}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-micro font-mono transition",
                          isModerator
                            ? "border-purple-500/40 text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
                            : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        title={isModerator ? "Revoke Mod Role" : "Grant Mod Role"}
                      >
                        {isModerator ? "-Mod" : "+Mod"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Dialog Modal */}
      {activeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-background p-5 shadow-2xl">
            <h3 className="text-base font-bold">
              {activeDialog.type === "suspend" && "Suspend Account"}
              {activeDialog.type === "reactivate" && "Reactivate Account"}
              {activeDialog.type === "role" &&
                `${activeDialog.roleGrant ? "Grant" : "Revoke"} ${activeDialog.roleTarget?.toUpperCase()} Role`}
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              User: <strong className="text-foreground">@{activeDialog.user?.username ?? activeDialog.user?.id}</strong>
            </p>

            {actionError && (
              <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {actionError}
              </div>
            )}

            {(activeDialog.type === "suspend" || activeDialog.type === "reactivate") && (
              <div className="mt-4 space-y-1.5">
                <label className="text-micro font-semibold uppercase text-muted-foreground">
                  Official Administrative Reason (Required)
                </label>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Enter reason for audit logs and transparency…"
                  rows={3}
                  className="w-full rounded-xl border border-border/80 bg-muted/20 p-2.5 text-xs focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {activeDialog.type === "role" && (
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Are you sure you want to {activeDialog.roleGrant ? "grant" : "revoke"}{" "}
                <span className="font-semibold text-foreground">{activeDialog.roleTarget}</span> permissions for this
                account? This will immediately take effect across the database.
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                disabled={busy}
                className="rounded-xl border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeDialog.type === "suspend") handleSuspend();
                  else if (activeDialog.type === "reactivate") handleReactivate();
                  else if (activeDialog.type === "role") handleToggleRole();
                }}
                disabled={busy}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-xs font-semibold transition",
                  activeDialog.type === "suspend"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {busy ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
