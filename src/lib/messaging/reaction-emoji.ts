/**
 * The six emoji the message_reactions CHECK constraint admits, in display
 * order. Pure module (no server imports) because both the client reaction bar
 * and the server action validate against it.
 *
 * `labelKey` points into the shared `reactions` i18n namespace so the message
 * bar and the post bar say the same words for the same glyph.
 */
export const MESSAGE_REACTIONS = [
  { emoji: "👍", labelKey: "like" },
  { emoji: "❤️", labelKey: "love" },
  { emoji: "😂", labelKey: "laugh" },
  { emoji: "😮", labelKey: "wow" },
  { emoji: "😢", labelKey: "sad" },
  { emoji: "🐾", labelKey: "paw" },
] as const;

export type MessageReactionEmoji = (typeof MESSAGE_REACTIONS)[number]["emoji"];

export function isMessageReactionEmoji(value: string): value is MessageReactionEmoji {
  return MESSAGE_REACTIONS.some((r) => r.emoji === value);
}
