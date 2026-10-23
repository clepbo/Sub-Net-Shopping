import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { Page } from "@/components/ui";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("CUSTOMER");
  const order = await db.order.findFirst({
    where: { id: (await params).id, customerId: user.id },
    include: { items: true, supermarket: true, customer: { select: { firstName: true, lastName: true } }, payments: { include: { refunds: true } } },
  });
  if (!order) notFound();
  return (
    <Page className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Order
        </Link>
        <PrintButton />
      </div>
      <Receipt order={order} />
    </Page>
  );
}
