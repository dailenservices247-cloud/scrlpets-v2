export const PREFERENCES_COOKIE = "scrlpets_user_prefs";
export const NOTIFICATIONS_COOKIE = "scrlpets_notif_prefs";

export type UserPreferences = {
  units: "imperial" | "metric";
  timeFormat: "12h" | "24h";
  autoplayMedia: "always" | "wifi" | "never";
};

export type NotificationPreferences = {
  messages: boolean;
  milestones: boolean;
  packActivity: boolean;
  sounds: boolean;
  orders: boolean;
};
