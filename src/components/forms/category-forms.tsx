"use client";

import { useActionState } from "react";
import { deleteCategory, saveCategory } from "@/app/actions/categories";
import { Field, FormMessage, Select, SubmitButton } from "../form";

type Category = { id: string; name: string; icon: string | null; sortOrder: number; parentId: string | null };

export function CategoryForm({ category, parents }: { category?: Category; parents: { value: string; label: string }[] }) {
  const [state, action] = useActionState(saveCategory, {});
  // A new category's form is cleared after a successful add.
  const key = category ? category.id : (state.ok ?? "new");
  return (
    <form key={key} action={action} className="space-y-3" noValidate>
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field label="Name" name="name" defaultValue={category?.name} state={state} />
        <Field label="Icon" name="icon" defaultValue={category?.icon ?? ""} placeholder="🛒" state={state} />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Select
          label="Parent"
          name="parentId"
          defaultValue={category?.parentId ?? ""}
          options={[{ value: "", label: "None (top-level)" }, ...parents.filter((p) => p.value !== category?.id)]}
          state={state}
        />
        <Field label="Order" name="sortOrder" inputMode="numeric" defaultValue={String(category?.sortOrder ?? 0)} state={state} />
      </div>
      <SubmitButton size="sm" variant={category ? "secondary" : "primary"}>
        {category ? "Save" : "Add category"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(deleteCategory, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete “${name}”?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" className="text-red-700" pendingText="…">
        Delete
      </SubmitButton>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
