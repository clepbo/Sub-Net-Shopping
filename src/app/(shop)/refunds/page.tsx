import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" intro="When you get money back, and how long it takes.">
      <section>
        <h2>You&apos;re refunded automatically when</h2>
        <ul>
          <li>The supermarket cancels or rejects a paid order: the full amount.</li>
          <li>An item is out of stock and removed from a paid order: the price of that item.</li>
          <li>A paid delivery can&apos;t be completed for a reason that isn&apos;t yours (for example, the rider can&apos;t reach the store): the full amount including delivery.</li>
        </ul>
      </section>
      <section>
        <h2>Problems with your items</h2>
        <p>
          If an item is missing, damaged, expired or wrong, report it within 24 hours of pickup or delivery from your order page or by
          emailing support. Once confirmed, we refund the item or arrange a replacement.
        </p>
      </section>
      <section>
        <h2>Failed deliveries</h2>
        <p>
          If no one is available at the delivery address or the address is wrong, the rider will try to reach you. If the delivery still
          can&apos;t be made, the order goes back to the store. You&apos;ll be refunded for the goods; the delivery fee is not refunded.
        </p>
      </section>
      <section>
        <h2>Cancelling</h2>
        <p>You can cancel any order before the supermarket confirms it, for a full refund. After that, contact support.</p>
      </section>
      <section>
        <h2>How refunds are paid</h2>
        <ul>
          <li>Card and transfer payments are refunded to the original payment method, usually within 3–10 working days depending on your bank.</li>
          <li>Pay-at-store and cash-on-delivery orders are only charged for what you receive, so there is usually nothing to refund. If you paid for something you didn&apos;t get, we refund by bank transfer.</li>
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-brand-700 underline">{SUPPORT_EMAIL}</a>
        </p>
      </section>
    </LegalPage>
  );
}
