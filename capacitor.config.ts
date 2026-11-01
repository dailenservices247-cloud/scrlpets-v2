import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.scrlpets.app",
  appName: "Scrlpets",
  webDir: "public",
  server: {
    url: "https://scrlpets.com",
    cleartext: false,
    allowNavigation: [
      "scrlpets.com",
      "*.scrlpets.com",
      "*.supabase.co",
      "connect.stripe.com",
      "checkout.stripe.com",
      "js.stripe.com"
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#18181b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
