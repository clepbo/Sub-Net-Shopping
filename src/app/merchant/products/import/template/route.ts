import { CSV_TEMPLATE } from "@/lib/csv-import";
import { requireUser } from "@/lib/auth";

export async function GET() {
  await requireUser("SUPERMARKET");
  return new Response(CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sub-net-products-template.csv"',
    },
  });
}
