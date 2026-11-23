"use client";

import { useActionState } from "react";
import { ShoppingCart } from "lucide-react";
import { addListToCart } from "@/app/actions/cart";
import { SubmitButton } from "../form";

export function AddListToCart({ supermarketId, inventoryIds, returnTo, label }: { supermarketId: string; inventoryIds: string[]; returnTo: string; label: string }) {
  const [state, action] = useActionState(addListToCart, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="supermarketId" value={supermarketId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {inventoryIds.map((id) => (
        <input key={id} type="hidden" name="inventoryId" value={id} />
      ))}
      <SubmitButton className="w-full" pendingText="Adding…">
        <ShoppingCart className="h-4 w-4" aria-hidden /> {label}
      </SubmitButton>
      {state.error && <p className="text-xs font-medium text-red-600">{state.error}</p>}
    </form>
  );
}
