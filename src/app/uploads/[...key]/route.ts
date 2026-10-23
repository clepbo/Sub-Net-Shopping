import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

// Serves files written by the local storage driver. Keys are random UUIDs,
// so responses can be cached forever.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const file = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, ...key);
  const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(UPLOAD_ROOT + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
