import Link from "next/link";

const sections = [
  {
    title: "Eligibility",
    body: "You must be at least 18 years old to create a Scrlpets account, publish content, or participate in the marketplace. Browsing public content does not require an account.",
  },
  {
    title: "Using Scrlpets",
    body: "Public animal, seller, listing, and product content can be browsed without an account. An account is required to publish, message, inquire, or begin any checkout.",
  },
  {
    title: "Account responsibilities",
    body: "Provide accurate information, protect your account credentials, and do not impersonate another person or organization. Future animal transactions and selling privileges may require additional identity and program verification.",
  },
  {
    title: "Animal welfare and marketplace conduct",
    body: "Do not post fraudulent listings, misrepresent an animal, promote cruelty, evade applicable breeding or sales requirements, or use Scrlpets to facilitate unlawful activity. Scrlpets may restrict content or accounts to protect people and animals.",
  },
  {
    title: "Transactions",
    body: "Scrlpets does not currently process animal or product checkout. When transaction features launch, their verification, payment, refund, and dispute rules will be presented before use. Guest checkout will not be offered.",
  },
  {
    title: "Your content",
    body: "You keep ownership of content you publish and give Scrlpets permission to host, display, distribute, and technically process it to operate the service.",
  },
  {
    title: "Availability and enforcement",
    body: "The service may change or experience interruptions. Scrlpets may remove content or suspend access when these terms, safety requirements, or applicable law are violated.",
  },
];

export default function TermsPage() {
  return (
    <main className="p-6">
      <Link href="/" className="text-sm text-brand-link underline">
        Back to Scrlpets
      </Link>
      <p className="eyebrow mt-8">Effective July 4, 2026</p>
      <h1 className="mt-2 text-3xl font-semibold">Terms</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        These terms describe the current Scrlpets v2 service and will be expanded before transactions or verification launch.
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
        Questions: legal@synapsedynamics.io ·{" "}
        <Link href="/privacy" className="text-brand-link underline">
          Privacy Notice
        </Link>
      </p>
    </main>
  );
}
