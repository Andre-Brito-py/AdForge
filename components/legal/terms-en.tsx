import { getCompany, LEGAL_UPDATED_AT_EN } from "@/lib/company";
import { getAppConfig } from "@/lib/config";

export async function TermsEn() {
  const COMPANY = await getCompany();
  const fee = (await getAppConfig()).settings.cancellationFeePercent;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm">Last updated: {LEGAL_UPDATED_AT_EN}</p>

      <h2>1. Who we are</h2>
      <p>
        Vysify is an online service operated by <strong>{COMPANY.name}</strong>, a company registered in Brazil under CNPJ {COMPANY.cnpj}, with its
        registered office at {COMPANY.address} (“Vysify”, “we”, “us”). Contact: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </p>

      <h2>2. The service</h2>
      <p>
        Vysify uses third-party artificial intelligence models to create strategies, copy, images, videos and voiceovers for advertisements based on the
        information and product photos you provide (“Creatives”). By creating an account you confirm that you are at least 18 years old and have the legal
        capacity to enter into this agreement. If you use Vysify on behalf of a company, you accept these Terms on its behalf.
      </p>

      <h2>3. Credits, prices and taxes</h2>
      <ul>
        <li>Generations consume credits according to the price table shown in the platform before each generation.</li>
        <li>Credits are sold in <strong>one-off packs</strong> (single payment, no renewal) or <strong>monthly plans</strong>, renewed automatically every month until cancelled.</li>
        <li>
          You can cancel a subscription at any time under Buy credits. After cancelling <strong>no future charges are made</strong>: the plan stays active until
          the end of the paid period and the credits you received stay in your balance.{" "}
          {fee > 0
            ? <>A cancellation fee of <strong>{fee}% of one monthly fee</strong> applies, charged once and shown before subscribing and before you confirm the cancellation; it is never charged within the first 7 days of the subscription (right of withdrawal).</>
            : <>There is no cancellation fee.</>}
        </li>
        <li>Credits do not expire while your account is active and cannot be exchanged for cash, except as described in section 4.</li>
        <li>If a generation fails for technical reasons, the credits for that generation are refunded to your balance automatically.</li>
        <li>
          Prices are shown in the selected currency. Depending on your location, value-added tax, GST or sales tax may be calculated and added at
          checkout. Business customers can enter a tax ID (e.g. VAT number) to receive an invoice.
        </li>
        <li>International payments are processed by Stripe. We never store your card details.</li>
      </ul>

      <h2>4. Refunds and right of withdrawal</h2>
      <p>
        You may request a refund of <strong>unused credits within 14 days</strong> of purchase by writing to{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. The amount is returned to the original payment method.
      </p>
      <p>
        If you are a consumer in the European Union or the United Kingdom, you have a statutory 14-day right of withdrawal. Because credits are digital
        content supplied immediately, by purchasing and using credits within that period you expressly request immediate performance and acknowledge that you
        lose the right of withdrawal for the credits you have already used. Unused credits remain refundable within the 14-day period.
      </p>
      <p>Nothing in these Terms limits any mandatory refund right you have under the consumer law of your country of residence.</p>

      <h2>5. Acceptable use</h2>
      <p>Vysify may only be used to create advertising for lawful products and services. You must not use it to create content that:</p>
      <ul>
        <li>contains nudity, sexual content, violence or weapons, illegal drugs, or promotes illegal activities;</li>
        <li>uses the image, voice or name of real people without authorization, including deepfakes;</li>
        <li>is misleading or deceptive advertising, including unsupported health, cure or guaranteed-income claims;</li>
        <li>infringes trademarks, copyrights or image rights of third parties;</li>
        <li>is political, discriminatory or hateful;</li>
        <li>violates the advertising rules of the country where it will be shown or of the platform where it will be published;</li>
        <li>shows anyone who appears to be under 18 in underwear, swimwear or any sensual context.</li>
      </ul>
      <p>
        Underwear, lingerie, shapewear and swimwear are allowed <strong>as products</strong>: on a hanger, a mannequin, as a flat lay or worn by adults in
        catalog poses, with intimate areas covered and no see-through fabric. Uploaded images (product photo, logo and reference images) go through automated
        moderation and may be rejected. By attaching photos of people you confirm you are authorized to use their image; we record that confirmation.
      </p>
      <p>
        We use automated moderation that may block requests before you are charged. Violations may lead to account suspension. Credits of accounts
        suspended for serious breaches of these Terms are not refundable, except where the law requires otherwise.
      </p>

      <h2>6. Your content and the Creatives</h2>
      <ul>
        <li>You confirm you hold the necessary rights to the photos, trademarks and information you upload.</li>
        <li>You may use the Creatives generated from your content for commercial purposes, worldwide.</li>
        <li>
          AI-generated content can contain inaccuracies or resemble other content. <strong>Review Creatives before publishing</strong>, especially prices,
          product features, claims and translations. You are responsible for the ads you run and for complying with local advertising and consumer laws.
        </li>
        <li>You grant us a limited licence to store and process your content solely to provide the service. We do not use your photos to train our own models.</li>
      </ul>

      <h2>7. Publishing to social networks</h2>
      <p>
        If you connect a Facebook/Instagram account, you authorize Vysify to publish <strong>only</strong> the Creatives you choose, to the account and
        format you select, when you click “Publish”. You remain responsible for the published content and for complying with Meta’s policies. You can
        disconnect at any time in Integrations.
      </p>

      <h2>8. Availability</h2>
      <p>
        We work to keep the service available, but it depends on third-party AI providers and infrastructure and may experience interruptions or maintenance.
        AI results vary and we do not guarantee any sales performance of your ads.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability arising from the service is limited to the amount you paid us in the 12 months before the
        event giving rise to the claim. We are not liable for indirect or consequential losses. These limitations do not apply to liability that cannot be
        excluded by law, and they do not affect your statutory rights as a consumer.
      </p>

      <h2>10. Termination</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that breach these Terms, with notice where possible.</p>

      <h2>11. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of Brazil. If you are a consumer, you also benefit from any mandatory provisions of the law of your country of
        residence, and you may bring proceedings in the courts of your country of residence. Before going to court, please contact us: most issues are solved
        quickly by email.
      </p>

      <h2>12. Changes</h2>
      <p>We may update these Terms. Material changes will be announced by email or in the platform with reasonable notice before they take effect.</p>

      <p className="mt-10 text-sm">
        The Portuguese version of these Terms applies to customers in Brazil. In case of conflict for customers outside Brazil, this English version prevails.
      </p>
    </>
  );
}
