import { COMPANY, LEGAL_UPDATED_AT_EN } from "@/lib/company";

export function PrivacyEn() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm">Last updated: {LEGAL_UPDATED_AT_EN}</p>

      <p className="mt-6">
        This policy explains how <strong>{COMPANY.name}</strong> (CNPJ {COMPANY.cnpj}, {COMPANY.address}), the data controller, processes personal data
        in Vysify. It is written to comply with the EU and UK General Data Protection Regulation (GDPR / UK GDPR), the California Consumer Privacy Act as
        amended by the CPRA (CCPA), and Brazil’s LGPD (Law 13.709/2018).
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, email, password (stored only as an irreversible hash), language, country (derived from your IP at sign-up) and, if enabled, your 2FA secret.</li>
        <li><strong>Content:</strong> product photos and descriptions, Brand Kit and the Creatives you generate.</li>
        <li><strong>Payments:</strong> pack purchased, amount, currency, date and transaction ID. Card details are handled by Stripe or Mercado Pago, never by us.</li>
        <li><strong>Connected accounts (Facebook/Instagram):</strong> if you connect a Meta account, we store its ID and name, the Pages and Instagram accounts you authorized, and an encrypted access token. We use them only to publish the Creatives you choose and to show you the post link.</li>
        <li><strong>Usage and security:</strong> credit history and technical logs (IP address, date and time) to prevent fraud and abuse.</li>
      </ul>

      <h2>2. Purposes and legal bases</h2>
      <ul>
        <li>Providing the service and processing payments — <em>performance of a contract</em> (GDPR art. 6(1)(b)).</li>
        <li>Security, fraud prevention and rate limiting — <em>legitimate interests</em> (art. 6(1)(f)).</li>
        <li>Keeping access logs and tax records — <em>legal obligation</em> (art. 6(1)(c)).</li>
        <li>Product news and tips by email, and optional analytics/marketing cookies — <em>consent</em> (art. 6(1)(a)), which you can withdraw at any time.</li>
      </ul>
      <p>We do not sell your personal data and we do not use your photos to train our own models. We do not make decisions with legal effects about you based solely on automated processing.</p>

      <h2>3. Who we share data with</h2>
      <p>Only with processors needed to run the service, under contract:</p>
      <ul>
        <li>AI providers: Google (Gemini), fal.ai, ElevenLabs and OpenAI — they receive the photos and text needed for each generation;</li>
        <li>Payments: Stripe and Mercado Pago;</li>
        <li>Meta Platforms (Facebook and Instagram) — receives the image or video and caption you decide to publish, on the account you choose;</li>
        <li>Infrastructure: Vercel (hosting), Supabase (database and storage) and Resend (transactional email).</li>
      </ul>

      <h2>4. International transfers</h2>
      <p>
        We are based in Brazil and some processors are located in the United States and other countries. When personal data from the EEA, the UK or
        Switzerland is transferred to countries without an adequacy decision, we rely on the European Commission’s Standard Contractual Clauses (and the UK
        Addendum) or other safeguards under GDPR Chapter V. You can request a copy of these safeguards by contacting us.
      </p>

      <h2>5. Retention</h2>
      <ul>
        <li>Account data and content: while your account exists. When you delete your account, we delete the account, products, campaigns and files.</li>
        <li>Payment records: 5 years, to meet tax obligations.</li>
        <li>Access logs: 6 months.</li>
        <li>Meta tokens: until you disconnect the account, remove Vysify from your Facebook settings or delete your account.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p><strong>Everyone</strong> can, directly in the app, <strong>download their data</strong> and <strong>delete their account</strong> (Settings › Privacy and data).</p>
      <p><strong>EU/EEA and UK residents (GDPR):</strong> right of access, rectification, erasure, restriction, data portability, objection, and to withdraw consent at any time. You may also lodge a complaint with your local data protection authority.</p>
      <p>
        <strong>California residents (CCPA/CPRA):</strong> right to know what personal information we collect and how we use it, to delete it, to correct it,
        and to opt out of its sale or sharing. <strong>We do not sell or share personal information</strong> for cross-context behavioral advertising. We will not
        discriminate against you for exercising your rights. You may use an authorized agent.
      </p>
      <p><strong>Brazil (LGPD):</strong> the rights in article 18 of the LGPD, including confirmation, access, correction, anonymization, portability and deletion.</p>
      <p>
        To exercise any right, email <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. We may need to verify your identity. We respond
        within one month (GDPR), 45 days (CCPA) or 15 days (LGPD).
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and remember your language, currency and theme. Analytics or marketing cookies are only used if
        enabled and <strong>only after you consent</strong>. See the <a href="/legal/cookies">Cookie Policy</a>.
      </p>

      <h2>8. Children</h2>
      <p>Vysify is intended for businesses and people aged 18 or over. We do not knowingly collect data from children.</p>

      <h2>9. Security</h2>
      <p>
        We use HTTPS, bcrypt password hashing, encrypted API keys and tokens, optional two-step verification, login attempt limits and per-account access
        control. No system is 100% secure; if a significant breach occurs, we will notify you and the competent authorities as required by law.
      </p>

      <h2>10. Contact and representatives</h2>
      <p>
        Data protection contact (DPO): <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
        {COMPANY.euRepresentative && <> EU representative (GDPR art. 27): {COMPANY.euRepresentative}.</>}
        {COMPANY.ukRepresentative && <> UK representative: {COMPANY.ukRepresentative}.</>}
      </p>

      <h2>11. Changes</h2>
      <p>We may update this policy. Material changes will be announced by email or in the platform before they take effect.</p>
    </>
  );
}
