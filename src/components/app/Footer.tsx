import Link from "next/link";
import { getTranslations } from "next-intl/server";

// The app had no footer at all, which made /terms and /privacy five taps deep
// and left /install reachable exactly once ever — its only inbound link was on
// /onboarding, which redirects away as soon as onboarded_at is set.
const GROUPS = [
  { key: "legal", links: [["terms", "/terms"], ["privacy", "/privacy"]] },
  {
    key: "help",
    links: [["support", "/support"], ["faq", "/faq"], ["guidelines", "/guidelines"]],
  },
  { key: "app", links: [["install", "/install"]] },
] as const;

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    // pb-24 is what main used to carry: the fixed BottomNav sits over the last
    // 4rem on mobile, and the footer is now the last thing above it.
    <footer
      className="mt-8 border-t border-border/60 px-4 pb-24 pt-6 lg:pb-8"
      data-testid="app-footer"
    >
      {/* Hardcoded landmark label, like BottomNav's aria-label="Primary". */}
      <nav aria-label="Footer" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <p className="eyebrow mb-2">{t(`${group.key}.title`)}</p>
            <ul className="flex flex-col gap-1.5">
              {group.links.map(([key, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                    data-testid={`footer-link-${key}`}
                  >
                    {t(`${group.key}.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </footer>
  );
}
