import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="How SubNet collects, uses and protects your personal data, in line with the Nigeria Data Protection Act 2023.">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: name, phone number, email and a securely hashed password.</li>
          <li>Order details: what you buy, from which supermarket, pickup times and delivery addresses (including a map pin if you add one).</li>
          <li>Payment records: amounts and references from our payment partners. We don&apos;t store card numbers.</li>
          <li>For supermarkets: business details, CAC number, bank account for payouts. For riders: vehicle and licence details, bank account and cash-collection records.</li>
          <li>Technical data: device and browser information and IP address, used for security such as blocking repeated failed sign-ins.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run your orders: sharing what&apos;s needed with the supermarket that fills them and the rider who delivers them.</li>
          <li>To send order updates by notification, email or SMS.</li>
          <li>To pay supermarkets and riders, prevent fraud and meet legal and tax obligations.</li>
          <li>To improve SubNet, using aggregated figures where possible.</li>
        </ul>
        <p>We don&apos;t sell your personal data.</p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <p>
          Supermarkets and riders involved in your order; payment, SMS, email, mapping and hosting providers who process data for us
          under contract; and authorities when the law requires it. Some providers may store data outside Nigeria with appropriate safeguards.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>Order and payment records are kept for at least six years for accounting and tax purposes. Other data is deleted or anonymised when no longer needed.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your data, object to its use, or withdraw consent, by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand-700 underline">{SUPPORT_EMAIL}</a>. You may also complain to the
          Nigeria Data Protection Commission.
        </p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Passwords are hashed, connections are encrypted, and access to personal data is limited to people who need it.</p>
      </section>
    </LegalPage>
  );
}
