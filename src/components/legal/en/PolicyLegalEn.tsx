import { Link } from "@tanstack/react-router";
import {
  OPERATOR,
  OPERATOR_INTRO_EN,
  OperatorIdentificationBlock,
} from "@/components/legal/OperatorInfo";

const ARTICLE = "prose prose-invert mx-auto max-w-2xl px-4 py-6 text-sm leading-relaxed";
const H2 = "mt-6 text-base font-semibold";
const P = "mt-2 text-foreground/85";
const UL = "mt-2 list-disc space-y-1 pl-5 text-foreground/85";
const OL = "mt-2 list-decimal space-y-1 pl-5 text-foreground/85";

export function CookiesEn({
  rows,
  onReopen,
}: {
  rows: {
    name: string;
    category: string;
    party: string;
    storage: string;
    duration: string;
    purpose: string;
  }[];
  onReopen: () => void;
}) {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 5 July 2026</p>

      <h2 className={H2}>1. What cookies are</h2>
      <p className={P}>
        Small files stored by your browser or device (HTTP cookies, localStorage, sessionStorage).
        We use them to make the app work, to remember your preferences and, if you agree, to analyse
        usage.
      </p>

      <h2 className={H2}>2. Categories</h2>
      <ul className={UL}>
        <li>
          <strong>Essential</strong> (always-on): authentication, session, CSRF, safety preferences.
          Legal basis: <em>legitimate interest</em> and <em>performance of the contract</em>.
        </li>
        <li>
          <strong>Preference</strong> (always-on): they remember UX choices YOU made (discreet mode,
          PIN, saved filters). Legal basis: <em>performance of the contract</em>.
        </li>
        <li>
          <strong>Analytics</strong> (opt-in): anonymous usage measurement. Legal basis:{" "}
          <em>consent</em>. The app currently uses NO third-party analytics.
        </li>
        <li>
          <strong>Marketing</strong> (opt-in): campaign attribution, recommendations. Legal basis:{" "}
          <em>consent</em>. We do NOT use third-party marketing cookies.
        </li>
      </ul>

      <h2 className={H2}>3. Exact list of cookies used</h2>
      <p className={P}>
        The list below reflects the cookies and localStorage entries the app actually sets. We use
        no tracking pixels, no Google Analytics, no Meta Pixel and no other third-party measurement
        SDKs.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">First / Third</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-[11px]">{c.name}</td>
                <td className="px-3 py-2">{c.category}</td>
                <td className="px-3 py-2">{c.party}</td>
                <td className="px-3 py-2">{c.storage}</td>
                <td className="px-3 py-2">{c.duration}</td>
                <td className="px-3 py-2">{c.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={H2}>4. How to manage your consent</h2>
      <p className={P}>You can change your choices at any time:</p>
      <button
        onClick={onReopen}
        className="mt-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
      >
        Reopen cookie settings
      </button>

      <h2 className={H2}>5. Please note</h2>
      <p className={P}>
        Essential cookies cannot be disabled — the app does not work without them. For analytics and
        marketing, refusing does not affect your access to features.
      </p>

      <h2 className={H2}>6. Operator and contact</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock compact />
      </div>
      <p className="mt-3">
        Questions:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.privacy}`}>
          {OPERATOR.emails.privacy}
        </a>{" "}
        · DPO:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
          {OPERATOR.emails.dpo}
        </a>
        .
      </p>
    </article>
  );
}

export function CommunityEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 22 June 2026</p>

      <h2 className={H2}>Our values</h2>
      <p className={P}>
        {OPERATOR.brand} (an app operated by {OPERATOR.legalName}) is a space for the LGBTQ+
        community in Romania. Here you look for connections, friendships, dates or love. Treat
        others the way you want to be treated: with respect, honesty and care.
      </p>

      <h2 className={H2}>What is forbidden</h2>
      <ul className={UL}>
        <li>
          <strong>Discrimination and hate</strong> — homophobia, transphobia, racism, antisemitism,
          islamophobia, ableism, sexism. Including in profile filters ("no fats, no fems, no asians"
          = discrimination).
        </li>
        <li>
          <strong>Outing</strong> — revealing someone else's LGBTQ+ identity without consent. Zero
          tolerance.
        </li>
        <li>
          <strong>Minors</strong> — any content involving people under 18. We report to NCMEC and to
          the authorities.
        </li>
        <li>
          <strong>Non-consensual nudity</strong> — sending intimate photos that were not asked for.
          We use AI for automatic detection.
        </li>
        <li>
          <strong>Harassment and threats</strong> — including stalking, sextortion, doxxing.
        </li>
        <li>
          <strong>Scams and prostitution</strong> — requests for money, crypto, IBAN,
          "investments", escorting.
        </li>
        <li>
          <strong>Impersonation</strong> — photos that are not yours, fake identity.
        </li>
        <li>
          <strong>Spam and commercial use</strong> — unauthorised promotion, suspicious links.
        </li>
        <li>
          <strong>Illegal content</strong> — drugs, weapons, human trafficking, terrorist content.
        </li>
      </ul>

      <h2 className={H2}>Consequences</h2>
      <ul className={UL}>
        <li>Warning + content removal.</li>
        <li>Temporary suspension.</li>
        <li>Permanent ban + reporting to the authorities for criminal offences.</li>
      </ul>

      <h2 className={H2}>Right to appeal (DSA Art. 20)</h2>
      <p className={P}>
        If your account or content has been restricted, you receive a notice with the reason and you
        have <strong>14 days</strong> to appeal by replying to that email or writing to{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.appeals}`}>
          {OPERATOR.emails.appeals}
        </a>
        . A human being (not an algorithm) reviews the appeal within 7 days.
      </p>

      <h2 className={H2}>Reporting</h2>
      <p className={P}>
        Use the report button on any profile or message. For serious abuse:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.trust}`}>
          {OPERATOR.emails.trust}
        </a>
        . For CSAM (content involving minors) we report directly to{" "}
        <a className="text-primary" href="https://safernet.ro" target="_blank" rel="noreferrer">
          safernet.ro
        </a>{" "}
        and INHOPE.
      </p>

      <h2 className={H2}>Resources</h2>
      <p className={P}>
        ACCEPT Romania —{" "}
        <a className="text-primary" href="tel:+40215635209">
          021 563 52 09
        </a>{" "}
        · Anti-violence helpline{" "}
        <a className="text-primary" href="tel:0800500333">
          0800 500 333
        </a>
        .
      </p>

      <h2 className={H2}>Operator</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock compact />
      </div>
    </article>
  );
}

export function AgePolicyEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 27 June 2026</p>

      <h2 className={H2}>1. Adults-only service</h2>
      <p className={P}>
        {OPERATOR.brand} is a dating and social app intended EXCLUSIVELY for people aged{" "}
        <strong>18 and over</strong>. The app is operated by {OPERATOR.legalName}. Creating an
        account or using the app as a minor is forbidden and breaches the Terms.
      </p>

      <h2 className={H2}>2. Age verification mechanisms</h2>
      <ul className={UL}>
        <li>
          <strong>At sign-up</strong> — explicit 18+ declaration (checkbox) plus date of birth with
          client and server validation. Accounts whose computed age is under 18 are refused, without
          storing the date of birth.
        </li>
        <li>
          <strong>Route age gate</strong> — every new account goes through the <em>AgeGate</em>{" "}
          before accessing Discover, Messages or Premium. In production this check is forced ON
          regardless of feature flags.
        </li>
        <li>
          <strong>Age estimation via Didit (external EU processor)</strong> — we capture a live
          selfie with a gesture challenge (liveness) and send it transiently to <strong>Didit</strong>
          , our <em>age estimation</em> processor. Didit runs an age estimation model on the image,
          returns only a pass/fail verdict (18+ or not) and deletes the image immediately.{" "}
          <strong>We do not request and do not store identity documents.</strong> Processing takes
          place in the EU under GDPR Art. 9(2)(a) — explicit consent for biometric data, recorded in{" "}
          <code>consent_log</code> before capture. See{" "}
          <Link className="text-primary" to="/legal/subprocessors">
            /legal/subprocessors
          </Link>{" "}
          for full details about Didit.
        </li>
        <li>
          <strong>Escalation for reports</strong> — if an account is reported as a suspected minor,
          the Trust &amp; Safety team requires Didit verification again and, if needed, suspends the
          account until a new passing estimation.
        </li>
        <li>
          <strong>Behavioural detection</strong> — signals (language, photos, reports) are escalated
          automatically to moderation. Suspicious accounts are suspended until re-verification.
        </li>
      </ul>

      <h2 className={H2}>3. What happens if we find a minor's account</h2>
      <ol className={OL}>
        <li>The account is suspended immediately and isolated (no inbound/outbound).</li>
        <li>
          All photos are moved to a quarantine bucket accessible only to the Trust &amp; Safety
          team.
        </li>
        <li>
          If there are indications of CSAM, we report to{" "}
          <a className="text-primary" href="https://safernet.ro" target="_blank" rel="noreferrer">
            Safernet.ro
          </a>{" "}
          and INHOPE; for the US, a report to NCMEC. Image hashes are added to the{" "}
          <em>csam_blocklist</em>.
        </li>
        <li>
          The account is permanently deleted within 7 days and the device fingerprint is banned
          permanently (see <em>banned_fingerprints</em>).
        </li>
        <li>
          We notify the competent authority (DIICOT — cybercrime unit, or local police) where
          exploitation is suspected.
        </li>
      </ol>

      <h2 className={H2}>4. Report a minor's account</h2>
      <p className={P}>
        Use the <strong>"Report → Minor (under 18)"</strong> button on any profile or message. For
        urgent cases:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.abuse}`}>
          {OPERATOR.emails.abuse}
        </a>
        . Guaranteed response within 24h. For CSAM material:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.csam}`}>
          {OPERATOR.emails.csam}
        </a>{" "}
        — monitored 24/7.
      </p>

      <h2 className={H2}>5. Parents and guardians</h2>
      <p className={P}>
        If you suspect a minor is using {OPERATOR.brand}, write to us at{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.parents}`}>
          {OPERATOR.emails.parents}
        </a>{" "}
        with minimal evidence (screenshots, device ID, account email). We suspend the account within
        24h and delete the data under GDPR Art. 8 (invalid consent of a minor).
      </p>

      <h2 className={H2}>6. Compliance</h2>
      <p className={P}>
        This policy complies with: GDPR Art. 8 (children's consent), Romanian Law 8/2008 (child
        protection), Romanian Criminal Code Art. 374 (child pornography), Regulation (EU) 2022/2065
        (DSA — Art. 28 on the protection of minors online) and the Google Play Families Policy.
      </p>

      <h2 className={H2}>7. Operator</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock compact />
      </div>
    </article>
  );
}

export function DmcaEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 27 June 2026</p>

      <h2 className={H2}>1. Legal framework</h2>
      <p className={P}>
        {OPERATOR_INTRO_EN} respects copyright under Romanian Law 8/1996, Directive (EU) 2019/790 on
        copyright in the Digital Single Market, the DSA (Reg. EU 2022/2065 Art. 16) and, for
        reporters in the US, the procedural principles of the Digital Millennium Copyright Act
        (DMCA).
      </p>

      <h2 className={H2}>2. How to send a takedown notice</h2>
      <p className={P}>
        Send a signed request to{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.copyright}`}>
          {OPERATOR.emails.copyright}
        </a>{" "}
        which MUST contain:
      </p>
      <ol className={OL}>
        <li>Identification of the protected work (title, author, original URL if available).</li>
        <li>
          Exact identification of the content on {OPERATOR.brand} (profile link, photo/message ID,
          screenshots).
        </li>
        <li>Your contact details: full name, address, phone, email.</li>
        <li>
          A statement, under your own responsibility, that you own the rights or act on behalf of
          the rights holder.
        </li>
        <li>A statement that the information is accurate and that you are authorised to act.</li>
        <li>An electronic signature or a scanned handwritten signature.</li>
      </ol>

      <h2 className={H2}>3. Response time</h2>
      <p className={P}>
        We acknowledge receipt within <strong>24h</strong>. We remove manifestly illegal content
        within a maximum of <strong>48h</strong>. We notify the user who posted it and offer them
        the right to counter-notify.
      </p>

      <h2 className={H2}>4. Counter-notice</h2>
      <p className={P}>
        If you believe the takedown was unjustified, send a counter-notice to the same address, with
        identification of the content, the reason, your details and consent to the jurisdiction of
        the Romanian courts. We restore the content within 10–14 working days if the complainant
        does not file a court action.
      </p>

      <h2 className={H2}>5. Abusive notices</h2>
      <p className={P}>
        Bad-faith notices (false claims) may attract civil liability under Art. 196 of Law 8/1996.
        We suspend the right to submit notices for users who abuse the procedure.
      </p>

      <h2 className={H2}>6. Repeat infringer policy</h2>
      <p className={P}>
        Accounts with three (3) validated notices within 12 months are closed permanently.
      </p>

      <h2 className={H2}>7. Operator and contact</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock compact />
      </div>
      <p className="mt-3 text-foreground/85">
        Copyright agent:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.copyright}`}>
          {OPERATOR.emails.copyright}
        </a>{" "}
        · DPO:{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.dpo}`}>
          {OPERATOR.emails.dpo}
        </a>{" "}
        · DSA:{" "}
        <Link className="text-primary" to="/legal/dsa">
          /legal/dsa
        </Link>
      </p>
    </article>
  );
}

export function DsaEn() {
  return (
    <article className={ARTICLE}>
      <p className="text-xs text-muted-foreground">Last updated: 22 June 2026</p>

      <h2 className={H2}>Service provider identification</h2>
      <div className="mt-2">
        <OperatorIdentificationBlock compact />
      </div>

      <h2 className={H2}>Single point of contact (DSA Art. 11–12)</h2>
      <ul className={UL}>
        <li>
          For authorities:{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.dsa}`}>
            {OPERATOR.emails.dsa}
          </a>
        </li>
        <li>
          For users:{" "}
          <a className="text-primary" href={`mailto:${OPERATOR.emails.trust}`}>
            {OPERATOR.emails.trust}
          </a>
        </li>
        <li>Languages: Romanian, English</li>
      </ul>

      <h2 className={H2}>Illegal content notice mechanism (Art. 16)</h2>
      <p className={P}>
        Any user or authority can report suspected illegal content through the "Report" button in
        the app or by email to{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.trust}`}>
          {OPERATOR.emails.trust}
        </a>
        . We acknowledge receipt within 24h and decide within a maximum of 7 days.
      </p>

      <h2 className={H2}>Right to appeal (Art. 20)</h2>
      <p className={P}>
        Moderation decisions can be appealed internally, free of charge, within 14 days at{" "}
        <a className="text-primary" href={`mailto:${OPERATOR.emails.appeals}`}>
          {OPERATOR.emails.appeals}
        </a>
        . Human response within a maximum of 7 days.
      </p>

      <h2 className={H2}>Transparency report (Art. 15)</h2>
      <p className={P}>
        We publish annual statistics on: the number of notices received, actions taken, suspended
        accounts and median response time. The first report will be published 12 months after public
        launch.
      </p>

      <h2 className={H2}>DSA coordinating authority in Romania</h2>
      <p className={P}>
        ANCOM —{" "}
        <a className="text-primary" href="https://www.ancom.ro" target="_blank" rel="noreferrer">
          ancom.ro
        </a>
      </p>

      <h2 className={H2}>Legal representative in the EU</h2>
      <p className={P}>
        {OPERATOR.legalName} is established in Romania (EU), so no separate representative is
        required under DSA Art. 13.
      </p>
    </article>
  );
}
