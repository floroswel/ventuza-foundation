import { Link } from "@tanstack/react-router";
import {
  OPERATOR,
  OPERATOR_INTRO_EN,
  OperatorIdentificationBlock,
} from "@/components/legal/OperatorInfo";

const ARTICLE =
  "prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed";
const H2 = "mt-6 text-base font-semibold";
const P = "mt-2 text-foreground/85";
const UL = "mt-2 list-disc space-y-1 pl-5 text-foreground/85";

export function TermsEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 20 June 2026</p>

      <h2 className={H2}>1. Acceptance of the terms</h2>
      <p className={P}>
        By creating a {OPERATOR.brand} account you confirm that you are at least{" "}
        <strong>18 years old</strong>, that you have the legal capacity to enter into this
        agreement and that you accept the terms below. The app is operated by {OPERATOR_INTRO_EN}.
        If you do not agree, please do not use the app.
      </p>

      <h2 className={H2}>2. Nature of the service</h2>
      <p className={P}>
        {OPERATOR.brand} is a dating and social platform for the LGBTQ+ community. We provide tools
        to create a profile, discover other users, chat privately and join events. We do not
        guarantee that you will find a partner, a relationship or any specific outcome.
      </p>

      <h2 className={H2}>3. User conduct</h2>
      <p className={P}>It is strictly forbidden to:</p>
      <ul className={UL}>
        <li>Impersonate another person or use photos that are not yours.</li>
        <li>Post sexually explicit content, nudity, minors, violence or illegal material.</li>
        <li>Harass, threaten, blackmail or discriminate against other users.</li>
        <li>Solicit money, paid sexual services or promote escorting.</li>
        <li>Share other users' personal data outside the app.</li>
        <li>Use the app for spam, phishing or unauthorised commercial purposes.</li>
      </ul>
      <p className={P}>
        Violations may lead to immediate suspension or deletion of your account, without prior
        notice, and to reporting to the competent authorities where applicable.
      </p>

      <h2 className={H2}>4. Your content</h2>
      <p className={P}>
        You own the photos and texts you upload. You grant {OPERATOR.brand} a non-exclusive,
        worldwide, royalty-free licence to store, display and transmit that content for the purpose
        of operating the service. We use automated (AI) moderation to detect prohibited content
        before publication.
      </p>

      <h2 className={H2}>5. Sensitive data and non-discrimination</h2>
      <p className={P}>
        Data about sexual orientation and gender identity is treated as special category data under
        the GDPR (Art. 9) and is displayed only if you choose to provide it. You can withdraw it at
        any time from <em>Settings → Consents</em>.
      </p>
      <p className={P}>
        <strong>{OPERATOR.brand} does not process HIV status data.</strong> We do not collect,
        store or display HIV status or testing dates.
      </p>

      <h2 className={H2}>5.1. Non-discrimination and protection of LGBTQ+ identity</h2>
      <p className={P}>
        {OPERATOR.brand} is built for the LGBTQ+ community. Discrimination based on sexual
        orientation, gender identity or expression, ethnicity, religion, disability, age or health
        status is strictly forbidden — including in profile descriptions, public filters or
        messages. Violations lead to immediate suspension.
      </p>
      <p className={P}>
        <strong>Involuntary outing is forbidden.</strong> Disclosing another user's sexual
        orientation, gender identity or any profile information to people outside the app (family,
        employer, social networks, redistributed screenshots) is a serious violation and may trigger
        civil or criminal liability under Romanian law (Government Ordinance 137/2000, Criminal Code
        Art. 226 — breach of private life). We reserve the right to cooperate with the authorities
        at the victim's request.
      </p>
      <p className={P}>
        Your queer identity is protected. We do not sell data to marketing brokers, we do not allow
        advertising targeting based on orientation or gender identity, and your location is never
        shared with other users in precise form.
      </p>

      <h2 className={H2}>6. Premium subscription</h2>
      <p className={P}>
        Premium features are purchased through Google Play. Transactions, taxes and the refund
        policy are handled by Google under its own terms. Subscriptions renew automatically until
        you cancel them from your Google Play account, at the latest 24 hours before the end of the
        current period.
      </p>

      <h2 className={H2}>7. Suspension and deletion</h2>
      <p className={P}>
        You can delete your account at any time from <em>Settings → Delete account</em>. Data is
        permanently removed within a maximum of 30 days. We reserve the right to suspend accounts
        that breach these terms.
      </p>

      <h2 className={H2}>8. Limitation of liability</h2>
      <p className={P}>
        {OPERATOR.brand} does not verify the real identity of users beyond photo moderation and
        optional selfie verification. Physical meetings happen at your own risk. We recommend safety
        practices (public place, informed friend, your own transport) and medical prevention
        (regular testing, PrEP).
      </p>

      <h2 className={H2}>9. Changes</h2>
      <p className={P}>
        We may update these terms. We will notify you through an in-app notification at least 14
        days before material changes take effect.
      </p>

      <h2 className={H2}>10. Governing law</h2>
      <p className={P}>
        This agreement is governed by Romanian law and applicable EU legislation. Disputes are
        settled by the competent courts at the operator's registered office ({OPERATOR.address}),
        subject to consumer rights under Romanian and EU law.
      </p>

      <h2 className={H2}>11. Operator and contact</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock />
      </div>
      <p className={P}>
        General questions:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.support}`}>
          {OPERATOR.emails.support}
        </a>
        . For alternative consumer dispute resolution: ANPC —{" "}
        <a className="text-primary" href="https://anpc.ro" target="_blank" rel="noreferrer">
          anpc.ro
        </a>{" "}
        and the ANPC alternative dispute resolution body —{" "}
        <a
          className="text-primary"
          href="https://anpc.ro/ce-este-sal/"
          target="_blank"
          rel="noreferrer"
        >
          anpc.ro/ce-este-sal/
        </a>
        . The European ODR platform was discontinued on 20 July 2025, so complaints go directly
        to ANPC.

      </p>
    </article>
  );
}

export function PrivacyEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 20 June 2026</p>

      <p className="mt-4 text-foreground/85">
        {OPERATOR_INTRO_EN} ("we") respects your privacy. This document explains what data we
        collect, why, who we share it with and what rights you have under the GDPR.
      </p>

      <h2 className={H2}>1. Data we collect</h2>
      <ul className={UL}>
        <li>
          <strong>Account:</strong> email, hashed password, date of birth.
        </li>
        <li>
          <strong>Profile:</strong> display name, photos, description, interests, city.
        </li>
        <li>
          <strong>Special category data (GDPR Art. 9) — optional, only with explicit consent:</strong>
          <ul className="mt-1 list-[circle] pl-5">
            <li>
              <strong>Sexual orientation / gender identity</strong> (gender, orientation, pronouns,
              tribes) — Art. 9(1) data concerning sex life.
            </li>
            <li>
              <strong>18+ verification selfie</strong> — Art. 9(1) biometric data. The image is
              transmitted transiently to our processor <strong>Didit</strong> (EU) solely for
              automated age estimation; Didit deletes the image immediately after issuing the result
              and returns only a pass/fail verdict. We do not request and do not store identity
              documents.
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            <strong>We do NOT process HIV status data.</strong> {OPERATOR.brand} has fully removed
            the collection and storage of HIV data.
          </p>
        </li>
        <li>
          <strong>Location:</strong> coordinates stay on your device; the server filters using{" "}
          <em>geographic buckets</em>, not raw lat/lng. Other users only see a rounded distance
          ("~500m", "~2km"), never precise coordinates.
        </li>
        <li>
          <strong>Activity:</strong> swipes, matches, messages, event RSVPs.
        </li>
        <li>
          <strong>Technical:</strong> IP, device type, OS, push notification identifier.
        </li>
        <li>
          <strong>Premium payments:</strong> the Google Play transaction token (we never see your
          card number).
        </li>
      </ul>

      <h2 className={H2}>2. Legal bases (GDPR Art. 6 and 9)</h2>
      <ul className={UL}>
        <li>
          <strong>Performance of a contract</strong> — to provide the service.
        </li>
        <li>
          <strong>Explicit consent</strong> — for biometric data (age verification selfie) and
          marketing notifications.
        </li>
        <li>
          <strong>Legitimate interest</strong> — moderation, fraud prevention, security.
        </li>
        <li>
          <strong>Legal obligation</strong> — responding to requests from authorities.
        </li>
      </ul>

      <h2 className={H2}>3. Who we share data with</h2>
      <ul className={UL}>
        <li>
          <strong>Other users</strong> — your public profile (photos, bio, interests).
        </li>
        <li>
          <strong>Sub-processors (full list:</strong>{" "}
          <Link className="text-primary" to="/legal/subprocessors">
            /legal/subprocessors
          </Link>
          <strong>):</strong>
          <ul className="mt-1 list-[circle] pl-5">
            <li>
              Supabase (via Lovable Cloud) — database, authentication, photo/media storage (EU,
              Frankfurt).
            </li>
            <li>
              <strong>Didit</strong> — age estimation from a selfie, transient processing in the EU,
              image deleted immediately, we only receive pass/fail.
            </li>
            <li>Lovable AI Gateway — text moderation, bio generation, embeddings (opt-in).</li>
            <li>Google Play Billing + RevenueCat — Premium payment processing.</li>
            <li>FCM / APNs / Mozilla autopush — push notification delivery.</li>
            <li>Cloudflare — edge runtime and CDN.</li>
            <li>ANAF — company registration lookup for business accounts (public authority).</li>
            <li>OpenStreetMap — map tiles (without user coordinates).</li>
          </ul>
        </li>
        <li>We do NOT sell your data to third parties for advertising.</li>
      </ul>

      <h2 className={H2}>4. Retention periods</h2>
      <ul className={UL}>
        <li>
          <strong>Active profile</strong> — for as long as the account exists.
        </li>
        <li>
          <strong>After deletion</strong> — permanent removal within 30 days (backups rotated within
          90 days).
        </li>
        <li>
          <strong>Inactive accounts</strong> {">"} 24 months — automatically anonymised (email and
          photos deleted).
        </li>
        <li>
          <strong>Private messages</strong> — kept while the conversation exists; deleting your
          account removes them.
        </li>
        <li>
          <strong>SOS events (panic location)</strong> — 12 months, then anonymised.
        </li>
        <li>
          <strong>Authentication and rate-limit logs</strong> — 90 days (legitimate interest,
          security).
        </li>
        <li>
          <strong>Abuse reports and moderation</strong> — 24 months (DSA legal obligation).
        </li>
        <li>
          <strong>Premium and advertiser invoices</strong> — 10 years (Romanian tax obligation).
        </li>
      </ul>

      <h2 className={H2}>4.1. DSA contact (Digital Services Act)</h2>
      <p className={P}>
        Single point of contact for authorities and users under DSA Art. 11-12:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.dsa}`}>
          {OPERATOR.emails.dsa}
        </a>
        . We answer in Romanian and English. See also the{" "}
        <Link className="text-primary" to="/legal/dsa">
          dedicated DSA page
        </Link>
        .
      </p>

      <h2 className={H2}>5. Your GDPR rights</h2>
      <ul className={UL}>
        <li>
          <strong>Access</strong> — a copy of your data (request at {OPERATOR.emails.support},
          answer within 30 days).
        </li>
        <li>
          <strong>Rectification</strong> — correct it directly from your profile.
        </li>
        <li>
          <strong>Erasure</strong> — directly from <em>Settings → Delete account</em>.
        </li>
        <li>
          <strong>Portability</strong> — JSON export on request.
        </li>
        <li>
          <strong>Objection</strong> — withdraw marketing consent from settings.
        </li>
        <li>
          <strong>Complaint</strong> — to the Romanian DPA, ANSPDCP (
          <a
            className="text-primary"
            href="https://www.dataprotection.ro"
            target="_blank"
            rel="noreferrer"
          >
            dataprotection.ro
          </a>
          ).
        </li>
      </ul>

      <h2 className={H2}>6. Security</h2>
      <p className={P}>
        We use TLS for all connections, Row Level Security to isolate data between users, passwords
        hashed with bcrypt, and photos stored in private buckets with temporary signed URLs. Photos
        are moderated by AI before publication.
      </p>

      <h2 className={H2}>7. Cookies</h2>
      <p className={P}>
        We only use essential technical cookies (authentication session). We do not use tracking or
        advertising cookies.
      </p>

      <h2 className={H2}>8. Minors</h2>
      <p className={P}>
        The app is forbidden to anyone under 18. We check age through the date of birth at
        onboarding. If we discover a minor's account, we delete it immediately. Report suspicions to{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.abuse}`}>
          {OPERATOR.emails.abuse}
        </a>
        .
      </p>

      <h2 className={H2}>9. International transfers</h2>
      <p className={P}>
        Data is stored in the EU. Sub-processors outside the EU (e.g. Google Cloud) operate under
        the European Commission's Standard Contractual Clauses.
      </p>

      <h2 className={H2}>10. Data controller</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Additional contact:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.privacy}`}>
          {OPERATOR.emails.privacy}
        </a>{" "}
        (privacy).
      </p>
    </article>
  );
}
