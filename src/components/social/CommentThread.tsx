"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { Heart } from "lucide-react";
import {
  addComment,
  editComment,
  deleteComment,
  setCommentReaction,
} from "@/lib/social/comment-actions";
import { REACTION_TYPES, type ReactionType } from "@/lib/social/reaction-types";
import { ReportButton } from "./ReportButton";
import type { CommentNode } from "@/lib/social/comments";

const EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  strong: "💪",
};

// F5 / punch list A16: compact per-comment reaction picker (same 6-set).
function CommentReactButton({
  node,
  signedIn,
  onMutated,
}: {
  node: CommentNode;
  signedIn: boolean;
  onMutated: () => void;
}) {
  const t = useTranslations("reactions");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = node.reactions.mine;
  const total = REACTION_TYPES.reduce((sum, k) => sum + node.reactions.counts[k], 0);
  const top = REACTION_TYPES.filter((k) => node.reactions.counts[k] > 0)
    .sort((a, b) => node.reactions.counts[b] - node.reactions.counts[a])
    .slice(0, 2);

  async function react(type: ReactionType) {
    if (!signedIn || busy) return;
    setBusy(true);
    setOpen(false);
    const result = await setCommentReaction(node.id, mine === type ? null : type);
    setBusy(false);
    if (result.ok) onMutated();
  }

  return (
    <span className="flex items-center gap-1">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className={`grid min-h-11 min-w-9 place-items-center rounded-lg transition hover:bg-muted/60 disabled:opacity-60 ${
            mine ? "text-brand-link" : "text-muted-foreground"
          }`}
          disabled={!signedIn}
          aria-label={mine ? t(mine) : t("react")}
          data-reaction={mine ?? "none"}
          data-testid="comment-react"
        >
          {mine ? (
            <span aria-hidden className="text-base leading-none">{EMOJI[mine]}</span>
          ) : (
            <Heart aria-hidden className="size-4" />
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={4} className="z-50">
            <Popover.Popup
              className="flex gap-0.5 rounded-full border border-border bg-popover px-1.5 py-1 shadow-xl"
              role="group"
              aria-label={t("label")}
            >
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => react(type)}
                  disabled={busy}
                  aria-pressed={mine === type}
                  aria-label={t(type)}
                  data-testid={`comment-reaction-${type}`}
                  className={`grid size-9 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-muted/60 ${
                    mine === type ? "bg-primary/20" : ""
                  }`}
                >
                  <span aria-hidden>{EMOJI[type]}</span>
                </button>
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {total > 0 && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="comment-reaction-total"
        >
          <span aria-hidden>{top.map((k) => EMOJI[k]).join("")}</span> {total}
        </span>
      )}
    </span>
  );
}

export function CommentThread({
  postId,
  nodes,
  count,
  signedIn,
  loginHref,
  onMutated,
}: {
  postId: string;
  nodes: CommentNode[];
  count: number;
  signedIn: boolean;
  loginHref: string;
  /** Feed usage refetches; destination usage defaults to router.refresh(). */
  onMutated?: () => void;
}) {
  const t = useTranslations("comments");
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const mutated = onMutated ?? (() => router.refresh());

  async function post(body: string, parentId?: string | null) {
    if (!body.trim()) return;
    setBusy(true);
    const result = await addComment(postId, body, parentId);
    setBusy(false);
    if (result.ok) {
      setText("");
      setReplyText("");
      setReplyTo(null);
      mutated();
    }
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setBusy(true);
    const result = await editComment(id, editText);
    setBusy(false);
    if (result.ok) {
      setEditId(null);
      mutated();
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const result = await deleteComment(id);
    setBusy(false);
    if (result.ok) mutated();
  }

  function Comment({ node, isReply }: { node: CommentNode; isReply: boolean }) {
    const name = node.authorDisplayName ?? node.authorUsername;
    return (
      <li className={isReply ? "ml-6 border-l border-border/60 pl-3" : ""} data-testid="comment">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          {node.isDeleted ? (
            <p className="text-sm italic text-muted-foreground" data-testid="comment-deleted">
              {t("deleted")}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Link href={`/u/${node.authorUsername}`} className="font-semibold text-brand-link">
                  {name}
                </Link>
                {node.edited && (
                  <span className="text-xs text-muted-foreground">{t("edited")}</span>
                )}
              </div>
              {editId === node.id ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={2000}
                    className="w-full rounded-lg border border-input bg-transparent p-2 text-sm"
                    rows={2}
                    aria-label={t("editLabel")}
                  />
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(node.id)}
                      disabled={busy}
                      data-testid="comment-edit-save"
                      className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {t("save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="min-h-11 rounded-md border border-input px-3 text-sm"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm" data-testid="comment-body">
                  {node.body}
                </p>
              )}
            </>
          )}

          {!node.isDeleted && editId !== node.id && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CommentReactButton node={node} signedIn={signedIn} onMutated={mutated} />
              {node.isMine ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(node.id);
                      setEditText(node.body);
                    }}
                    data-testid="comment-edit"
                    className="min-h-11 text-xs font-medium text-brand-link"
                  >
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(node.id)}
                    disabled={busy}
                    data-testid="comment-delete"
                    className="min-h-11 text-xs font-medium text-destructive disabled:opacity-50"
                  >
                    {t("delete")}
                  </button>
                </>
              ) : (
                signedIn && (
                  <>
                    {!isReply && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(node.id);
                          setReplyText("");
                        }}
                        data-testid="comment-reply"
                        className="min-h-11 text-xs font-medium text-brand-link"
                      >
                        {t("reply")}
                      </button>
                    )}
                    <ReportButton targetKind="comment" targetId={node.id} />
                  </>
                )
              )}
            </div>
          )}

          {replyTo === node.id && (
            <div className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={2000}
                placeholder={t("replyPlaceholder")}
                aria-label={t("replyPlaceholder")}
                className="w-full rounded-lg border border-input bg-transparent p-2 text-sm"
                rows={2}
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => post(replyText, node.id)}
                  disabled={busy || !replyText.trim()}
                  data-testid="comment-reply-submit"
                  className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t("reply")}
                </button>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="min-h-11 rounded-md border border-input px-3 text-sm"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
        {node.replies.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {node.replies.map((reply) => (
              <Comment key={reply.id} node={reply} isReply />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <section
      className="mt-4 border-t border-border/70 pt-4"
      data-testid="comment-thread"
    >
      <h2 className="text-sm font-semibold">{t("heading", { count })}</h2>

      {signedIn ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            data-testid="comment-input"
            className="w-full rounded-xl border border-input bg-transparent p-2 text-sm"
            rows={2}
          />
          <button
            type="button"
            onClick={() => post(text)}
            disabled={busy || !text.trim()}
            data-testid="comment-submit"
            className="mt-1 min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </div>
      ) : (
        <Link href={loginHref} className="mt-3 inline-block text-sm text-brand-link underline">
          {t("signInToComment")}
        </Link>
      )}

      {nodes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3" data-testid="comment-list">
          {nodes.map((node) => (
            <Comment key={node.id} node={node} isReply={false} />
          ))}
        </ul>
      )}
    </section>
  );
}
