import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro="These terms apply to everyone who uses SubNet Shopping: shoppers, supermarkets, supermarket staff and riders.">
      <section>
        <h2>1. What SubNet is</h2>
        <p>
          SubNet Shopping (&quot;SubNet&quot;, &quot;we&quot;) is an online marketplace that connects shoppers in Benin City, Edo State with
          independent supermarkets and with independent delivery riders. Supermarkets sell their own goods; SubNet is not the seller of
          the products listed.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>You must be at least 18 years old and give accurate details, including a phone number and email you can be reached on.</li>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>We may suspend accounts that break these terms, misuse the platform or put others at risk.</li>
        </ul>
      </section>
      <section>
        <h2>3. Orders, prices and payment</h2>
        <ul>
          <li>Prices are set by each supermarket and shown in Naira. Prices on SubNet include a service margin that funds the platform and payment processing.</li>
          <li>Stock is shown in good faith. If an item turns out to be unavailable, the supermarket may adjust your order and you will only pay for, or be refunded for, what you receive.</li>
          <li>Online payments are processed by our licensed payment partners. We never see or store your full card details.</li>
          <li>For pay-at-store or cash-on-delivery orders, you agree to pay the amount shown when you collect or receive your order.</li>
        </ul>
      </section>
      <section>
        <h2>4. Pickup and delivery</h2>
        <ul>
          <li>Pickup orders must be collected within the time you chose, using your pickup code. Uncollected orders may be cancelled.</li>
          <li>Delivery times are estimates. Please be available at the address you gave. If a delivery fails because no one is available, a re-delivery fee may apply.</li>
          <li>Check your items on receipt and report any problem within 24 hours.</li>
        </ul>
      </section>
      <section>
        <h2>5. Supermarkets</h2>
        <ul>
          <li>Supermarkets are reviewed and approved before they can sell. They must hold the licences their business requires and only list goods that are safe and lawful to sell.</li>
          <li>Supermarkets must keep prices, stock and opening hours accurate and honour orders they accept.</li>
          <li>SubNet deducts its commission and pays the balance to the supermarket&apos;s registered bank account on the published payout schedule.</li>
        </ul>
      </section>
      <section>
        <h2>6. Riders</h2>
        <ul>
          <li>Riders are independent contractors, not SubNet employees. They must hold a valid licence and keep their vehicle roadworthy.</li>
          <li>Cash collected from customers belongs to SubNet and the supermarket and must be remitted promptly. Accounts with unremitted cash above the limit are paused until it is paid.</li>
        </ul>
      </section>
      <section>
        <h2>7. Acceptable use</h2>
        <p>Don&apos;t misuse SubNet: no fraud, no fake orders or reviews, no harassment of staff or riders, and no attempts to break or overload the service.</p>
      </section>
      <section>
        <h2>8. Liability</h2>
        <p>
          To the extent the law allows, SubNet is not liable for the quality of goods sold by supermarkets or for indirect losses. Nothing in
          these terms limits rights you have under the Federal Competition and Consumer Protection Act 2018.
        </p>
      </section>
      <section>
        <h2>9. Changes and contact</h2>
        <p>
          We may update these terms and will show the date of the latest version above. These terms are governed by the laws of the
          Federal Republic of Nigeria. Questions: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand-700 underline">{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
