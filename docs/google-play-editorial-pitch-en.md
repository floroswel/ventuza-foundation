# Suzeta — Editorial Nomination for Google Play

Contact: contact@suzeta.eu · DPO: dpo@suzeta.app
Package: `app.suzeta` · Website: https://www.suzeta.app
Category: Dating · Content rating: 18+ · Country of origin: Romania

---

## 1. In one paragraph

Suzeta is a dating, friendship and events app for the LGBTQ+ community in
Romania, built in Romania, in Romanian and English. It exists because the apps
this community actually uses were designed somewhere else, for someone else,
and they charge for the features that keep people safe. Suzeta gives all of
them away for free: unlimited messages, seeing who liked you, profile boost,
travel mode, verification, AI assistance. The app pays for itself through
partnerships with LGBTQ-friendly venues and brands, not through subscriptions,
not through an ad network, and never through selling data.

## 2. Why this is worth a reader's attention

Romania is one of the harder places in the European Union to be openly queer.
Being outed can cost someone a job, a family, a place to live. That single fact
shaped every product decision in this app, and it is the part that makes Suzeta
different from a generic dating clone:

- **Your exact location never leaves your phone.** Distances shown to other
  users are bucketed ("under 1 km", "1 to 5 km"). The proximity notifications
  for venues and events are calculated on the device itself. There is no
  location history stored anywhere.
- **Anti-outing is a feature set, not a checkbox.** Incognito mode, private
  album with one-to-one unlock, discreet app behaviour, screenshot protection,
  and granular control over who can see what.
- **Safety tools you can reach in one tap.** Panic button with a 112 call and
  location shared to trusted contacts, fake incoming call to leave a bad
  situation, quick exit, PIN and biometric lock, and a country risk warning
  when someone travels somewhere less safe.
- **Special-category data is treated as such.** Optional health information is
  encrypted at column level and can only be written after explicit, recorded
  consent. Withdrawing that consent deletes the data in the same transaction.

## 3. What is genuinely new here

1. **A no-paywall dating app that still has a business model.** Every feature
   normally sold as Premium is free for every user. Revenue comes from a B2B
   partner portal where bars, clubs, clinics and event organisers pay to be
   listed and promoted. Partners are invoiced by bank transfer and confirmed
   manually, so there is no payment processor holding user data.
2. **Human moderation before publication, not after complaints.** No venue,
   event or offer becomes visible to users until a moderator approves it.
   Approval is a single audited server-side action; a partner cannot publish
   their own content, by design and enforced in the database.
3. **Verification without collecting an ID.** Age is checked through a live
   selfie sent to an EU processor that estimates age and deletes the image
   immediately. We never ask for, receive or store an identity document.
4. **A community layer, not just a grid.** A map of manually verified friendly
   venues, an events calendar built around Pride, parties, workshops and
   meetups, and an ambassador programme that rewards people for bringing their
   friends in.

## 4. Safety and policy alignment

- **18+ only, enforced.** Age verification is mandatory in production and cannot
  be switched off by configuration. Social features are gated at database level,
  not just hidden in the interface.
- **Child safety.** Zero tolerance for CSAM. Suspected material is never
  rendered anywhere in the product, including for staff; it is handled by hash
  and escalated to the authorities. Public policy pages:
  https://www.suzeta.app/child-safety and
  https://www.suzeta.app/legal/age-policy
- **DSA compliance.** Single point of contact, reporting flow under Article 16,
  and transparent appeals under Article 20: https://www.suzeta.app/legal/dsa
- **GDPR.** Appointed DPO, published subprocessor list, an internal Article 30
  register, data export under Article 20, and full account deletion.
  https://www.suzeta.app/legal/privacy ·
  https://www.suzeta.app/legal/subprocessors
- **No advertising ID.** The `AD_ID` permission is explicitly removed from the
  merged manifest. No AdMob, no cross-app tracking, no data brokers.
- **No background location permission.** Proximity works without it.
- **Anti-abuse.** Bot protection on every auth form, device fingerprinting,
  rate limits enforced in the database, and bilateral blocking that is applied
  by a database trigger rather than by the client.

## 5. Technical quality signals

- Native Android build with edge-to-edge support for Android 15 and later,
  targeting the current API level required by Play.
- `FLAG_SECURE` against screenshots and screen recording on sensitive screens,
  hardened WebView settings, certificate pinning in the network security
  config, and root and integrity checks.
- Offline support, persistent caching, image compression on upload, lazy
  loading and code splitting, with first-screen skeletons instead of spinners.
- Full Romanian and English localisation.

## 6. What we are asking for

Consideration for editorial placement in the Dating and Social categories,
and for any Google Play collection that highlights safety-first products,
locally built apps, or apps serving underrepresented communities in Central
and Eastern Europe.

We are happy to provide a pre-verified reviewer account, a demo walkthrough,
our DPIA, and our incident response plan on request.

## 7. Press kit

- Store listing: https://play.google.com/store/apps/details?id=app.suzeta
- Website: https://www.suzeta.app
- Feature graphic and icon: `store-assets/`
- Screenshots: `store-assets/README.md`
- Terms: https://www.suzeta.app/legal/terms
- Community guidelines: https://www.suzeta.app/community-guidelines
- Safety centre: https://www.suzeta.app/safety
