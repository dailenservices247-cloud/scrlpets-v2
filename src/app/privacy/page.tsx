import Link from "next/link";

const sections = [
  {
    title: "Information we collect",
    body: "Account information you provide, public profiles and animal content you publish, marketplace inquiries, and messages needed to operate Scrlpets. Verification documents and payment data are not part of the current product.",
  },
  {
    title: "How information is used",
    body: "We use information to provide accounts, public discovery, publishing, messaging, marketplace context, security, troubleshooting, and support.",
  },
  {
    title: "Public and private information",
    body: "Public profiles, animals, posts, listings, brands, and products can be viewed without an account. Email addresses, private messages, account controls, and future verification evidence are not public.",
  },
  {
    title: "Service providers",
    body: "Supabase provides authentication and application data storage, Vercel hosts the web application, Sentry receives technical error reports and a small sample of performance timing measurements, and PostHog receives optional analytics only after consent.",
  },
  {
    title: "Your choices",
    body: "You can decline optional analytics. Account correction, export, and deletion controls are being prepared; until those controls ship, privacy requests can be sent to privacy@synapsedynamics.io.",
  },
  {
    title: "Safety and retention",
    body: "We limit access through database policies and application permissions. Content and marketplace records may be retained when needed for safety, fraud prevention, dispute review, or legal obligations.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="p-6">
      <Link href="/" className="text-sm text-brand-link underline">
        Back to Scrlpets
      </Link>
      <p className="eyebrow mt-8">Effective July 4, 2026</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy Notice</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This notice describes the current Scrlpets v2 product. It will be updated as verification, payments, and additional services are introduced.
      </p>
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/terms" className="text-brand-link underline">
          Read the Terms
        </Link>
      </p>
    </main>
  );
}
