"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { formValues, type ActionState } from "@/lib/action-state";
import { categoryFields, fieldErrors } from "@/lib/validation";
import { Prisma } from "@/generated/prisma/client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function refresh() {
  revalidatePath("/", "layout");
}

async function validParent(parentId: string | null, selfId?: string) {
  if (!parentId) return true;
  if (parentId === selfId) return false;
  // Two levels only: a parent must itself be top-level.
  const parent = await db.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  return Boolean(parent && parent.parentId === null);
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const values = formValues(formData);
  const id = String(formData.get("id") ?? "") || undefined;
  const parsed = categoryFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  if (!(await validParent(d.parentId, id))) return { fieldErrors: { parentId: "Choose a top-level category" }, values };
  if (id && d.parentId && (await db.category.count({ where: { parentId: id } })) > 0) {
    return { fieldErrors: { parentId: "This category has subcategories, so it must stay top-level" }, values };
  }
  const slug = slugify(d.name);
  if (!slug) return { fieldErrors: { name: "Use letters or numbers in the name" }, values };

  try {
    if (id) await db.category.update({ where: { id }, data: { ...d, slug } });
    else await db.category.create({ data: { ...d, slug } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { name: "A category with this name already exists" }, values };
    }
    throw err;
  }
  await logActivity({ actorId: admin.id, action: id ? "category.updated" : "category.created", targetType: "category", details: d.name });
  refresh();
  return id ? { ok: "Category saved", values } : { ok: `Added “${d.name}”` };
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireUser("ADMIN");
  const id = String(formData.get("id") ?? "");
  const category = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!category) return { error: "Category not found" };
  if (category._count.children > 0) return { error: "Delete or move its subcategories first" };
  if (category._count.products > 0) return { error: `${category._count.products} products use this category. Move them first.` };
  await db.category.delete({ where: { id } });
  await logActivity({ actorId: admin.id, action: "category.deleted", targetType: "category", details: category.name });
  refresh();
  return { ok: `Deleted “${category.name}”` };
}
