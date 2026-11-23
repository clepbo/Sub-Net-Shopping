"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEditableStore } from "@/lib/supermarkets";
import { requireRider } from "@/lib/riders";
import { logActivity } from "@/lib/activity";
import { BANKS } from "@/lib/banks";
import { lookupAccountName } from "@/lib/payouts";
import { formValues, type ActionState } from "@/lib/action-state";
import { bankDetails, fieldErrors } from "@/lib/validation";

async function parseBank(formData: FormData) {
  const values = formValues(formData);
  const parsed = bankDetails.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { values, error: { fieldErrors: fieldErrors(parsed.error), values } as ActionState };
  const bank = BANKS.find((b) => b.code === parsed.data.bankCode);
  if (!bank) return { values, error: { fieldErrors: { bankCode: "Choose your bank" }, values } as ActionState };
  // Confirm the account with the bank when a payout provider is set up.
  const looked = await lookupAccountName(bank.code, parsed.data.bankAccountNumber);
  const name = looked ?? parsed.data.bankAccountName;
  if (!name) return { values, error: { fieldErrors: { bankAccountName: "Enter the name on the account" }, values } as ActionState };
  return {
    values,
    data: { bankCode: bank.code, bankName: bank.name, bankAccountNumber: parsed.data.bankAccountNumber, bankAccountName: name },
    verified: Boolean(looked),
  };
}

export async function saveStoreBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, store, blocked } = await requireEditableStore();
  const values = formValues(formData);
  if (blocked) return { error: blocked, values };
  const r = await parseBank(formData);
  if (r.error) return r.error;
  await db.supermarket.update({ where: { id: store.id }, data: r.data });
  await logActivity({ actorId: user.id, action: "supermarket.bank_updated", targetType: "supermarket", targetId: store.id, details: `${r.data.bankName} ••••${r.data.bankAccountNumber.slice(-4)}` });
  revalidatePath("/merchant", "layout");
  return { ok: r.verified ? `Saved: ${r.data.bankAccountName}` : "Bank details saved", values: { ...r.values, bankAccountName: r.data.bankAccountName } };
}

export async function saveRiderBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, rider } = await requireRider();
  const r = await parseBank(formData);
  if (r.error) return r.error;
  await db.rider.update({ where: { id: rider.id }, data: r.data });
  await logActivity({ actorId: user.id, action: "rider.bank_updated", targetType: "rider", targetId: rider.id, details: `${r.data.bankName} ••••${r.data.bankAccountNumber.slice(-4)}` });
  revalidatePath("/rider", "layout");
  return { ok: r.verified ? `Saved: ${r.data.bankAccountName}` : "Bank details saved", values: { ...r.values, bankAccountName: r.data.bankAccountName } };
}
