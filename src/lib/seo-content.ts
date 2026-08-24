/**
 * Sursă unică de adevăr pentru conținutul public SEO / AEO / GEO.
 * Textele de aici apar VIZIBIL în pagini și, doar apoi, în JSON-LD.
 * Nu adăuga aici afirmații care nu se regăsesc în aplicație.
 */

export const SITE_URL = "https://suzeta.app";
export const SUPPORT_EMAIL = "support@suzeta.ro";
export const PRIVACY_EMAIL = "dpo@suzeta.ro";
// JPEG, nu PNG: 1200x630 ca PNG cântărea 712 KB. Crawlerele de social media
// acceptă JPEG peste tot, iar previzualizarea se încarcă vizibil mai repede.
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
export const LOGO_512 = `${SITE_URL}/icon-512.png`;

export const HOME_TITLE = "Suzeta – Gay Dating & LGBTQ+ Chat App";

export const HOME_DESCRIPTION =
  "Suzeta is a gay dating and LGBTQ+ chat app for adults. Meet new people, match, chat privately and build real connections in a safer community.";

export const INTRO_PARAGRAPH =
  "Suzeta is a dating and social connection app for gay, bisexual, queer and other LGBTQ+ adults. Users can create profiles, discover people, match, chat privately and build friendships or meaningful relationships.";

export type FaqItem = { q: string; a: string };

/** Răspunsurile încep direct cu răspunsul (format citabil de motoarele AI). */
export const FAQ: FaqItem[] = [
  {
    q: "What is Suzeta?",
    a: "Suzeta is a dating and social connection app for gay, bisexual, queer and other LGBTQ+ adults. It allows users to create profiles, discover people, match and chat privately.",
  },
  {
    q: "Is Suzeta a dating app?",
    a: "Yes. Suzeta is a dating app for LGBTQ+ adults, and it is also used for chat, friendship and community connections.",
  },
  {
    q: "Who can use Suzeta?",
    a: "Adults aged 18 and over. Suzeta is built for gay, bisexual, queer and other LGBTQ+ adults, and age verification is required before an account can be used.",
  },
  {
    q: "Is Suzeta designed for LGBTQ+ adults?",
    a: "Yes. Suzeta is designed specifically for LGBTQ+ adults, with identity, pronoun and orientation options, LGBTQ+ community rules and moderation against homophobic or transphobic behaviour.",
  },
  {
    q: "Is Suzeta available in Romania?",
    a: "Yes. Suzeta is available in Romania and is built in Romania, with a Romanian and English interface and EU-based data processing under GDPR.",
  },
  {
    q: "Is Suzeta free to use?",
    a: "Yes. Suzeta is free to use. Creating a profile, discovering people, matching and private chat do not require a payment.",
  },
  {
    q: "How does matching work on Suzeta?",
    a: "You browse profiles in Discover and show interest in the people you like. When two members show interest in each other, a match is created and a private conversation becomes available.",
  },
  {
    q: "Can users chat privately?",
    a: "Yes. Private one-to-one chat is available between members, including text, photos and voice messages, with delivery and read receipts.",
  },
  {
    q: "Can users block and report profiles?",
    a: "Yes. Any member can block another account at any time and report a profile, photo or message. Blocking is mutual and enforced server-side, and reports are reviewed by the moderation team.",
  },
  {
    q: "How can users delete their Suzeta account?",
    a: "Open Settings in the app and choose Delete account, or visit suzeta.app/account-deletion. Deletion removes your profile, photos, messages and personal data. You can also write to " +
      SUPPORT_EMAIL +
      ".",
  },
  {
    q: "How does Suzeta protect user privacy?",
    a: "Your exact GPS coordinates are never shared with other members — other users only see an approximate distance range. You control what appears on your profile, you can hide your age and distance, and sensitive data is encrypted and processed in the EU under GDPR.",
  },
  {
    q: "Is Suzeta available on Android?",
    a: "Yes. Suzeta works in any modern browser at suzeta.app and as a native Android application.",
  },
  {
    q: "What is the minimum age for Suzeta?",
    a: "18 years. Suzeta is strictly for adults, and every account must pass age verification before it can be used.",
  },
  {
    q: "Can Suzeta be used for friendship as well as dating?",
    a: "Yes. Members use Suzeta for dating, chat, friendship and community events, and you can state what you are looking for on your profile.",
  },
];

export function faqPageSchema(id: string, items: FaqItem[] = FAQ) {
  return {
    "@type": "FAQPage",
    "@id": id,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbSchema(path: string, name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Suzeta", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}

/** Meta standard pentru o pagină publică secundară. */
export function publicPageMeta(opts: { title: string; description: string; path: string }) {
  const url = `${SITE_URL}${opts.path}`;
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Suzeta" },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
