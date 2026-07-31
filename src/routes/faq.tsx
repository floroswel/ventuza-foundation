import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFooter } from "@/components/PublicFooter";
import { FAQ, SITE_URL, breadcrumbSchema, faqPageSchema, publicPageMeta } from "@/lib/seo-content";

const TITLE = "Suzeta FAQ – Gay Dating & LGBTQ+ Chat App Questions";
const DESCRIPTION =
  "Answers about Suzeta: what the app is, who can use it, how matching and private chat work, safety, privacy, Android availability and how to delete your account.";

export const Route = createFileRoute("/faq")({
  head: () => ({
    ...publicPageMeta({ title: TITLE, description: DESCRIPTION, path: "/faq" }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema("/faq", "FAQ")),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          ...faqPageSchema(`${SITE_URL}/faq#faq`),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Suzeta – frequently asked questions</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Short, factual answers about Suzeta, the gay dating and LGBTQ+ chat app for adults.
        </p>

        <dl className="mt-8 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-border bg-surface p-5">
              <dt className="text-base font-semibold text-foreground">
                <h2 className="text-base font-semibold">{item.q}</h2>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-muted-foreground">
          More detail on{" "}
          <Link to="/about" className="text-primary hover:underline">
            About Suzeta
          </Link>
          ,{" "}
          <Link to="/safety" className="text-primary hover:underline">
            Safety
          </Link>{" "}
          and{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Contact
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
