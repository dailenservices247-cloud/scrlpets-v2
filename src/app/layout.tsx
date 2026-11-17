import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PREFERENCES_COOKIE } from "@/lib/settings/constants";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app",
  ),
  title: { default: "Scrlpets", template: "%s · Scrlpets" },
  description: "The trusted home for animals.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scrlpets",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  let a11yPrefs = { reduceMotion: false, highContrast: false, largeText: false };
  const rawPrefs = cookieStore.get(PREFERENCES_COOKIE)?.value;
  if (rawPrefs) {
    try {
      const parsed = JSON.parse(rawPrefs) as Record<string, unknown>;
      a11yPrefs = {
        reduceMotion: Boolean(parsed.reduceMotion),
        highContrast: Boolean(parsed.highContrast),
        largeText: Boolean(parsed.largeText),
      };
    } catch {
      // Malformed preference cookie falls back to defaults.
    }
  }

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
      data-reduce-motion={a11yPrefs.reduceMotion ? "true" : undefined}
      data-high-contrast={a11yPrefs.highContrast ? "true" : undefined}
      data-large-text={a11yPrefs.largeText ? "true" : undefined}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <a
          href="#main-content"
          data-testid="skip-to-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
