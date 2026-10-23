import "server-only";
// File storage for logos and product images (PRD §8: images live in
// storage, the database keeps only the URL and key).
//
// - "blob": Vercel Blob. Chosen automatically when BLOB_READ_WRITE_TOKEN is
//   set, which is how it runs on Vercel (the filesystem there is read-only).
// - "local": writes to UPLOAD_DIR (default ./uploads); files are served by
//   app/uploads/[...key]/route.ts. For development and single-server hosting.
//
// Override the choice with STORAGE_DRIVER.
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  /** Deletes a file previously returned by put(); ignores URLs it doesn't own. */
  delete(url: string): Promise<void>;
}

export const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const localDriver: StorageDriver = {
  async put(key, data) {
    const file = path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { url: `/uploads/${key}` };
  },
  async delete(url) {
    if (!url.startsWith("/uploads/")) return;
    const file = path.resolve(/*turbopackIgnore: true*/ UPLOAD_ROOT, url.slice("/uploads/".length));
    if (file.startsWith(UPLOAD_ROOT + path.sep)) await unlink(file).catch(() => {});
  },
};

const blobDriver: StorageDriver = {
  async put(key, data, contentType) {
    // Keys already contain a random UUID, so no extra suffix is needed.
    const blob = await put(key, data, { access: "public", contentType, addRandomSuffix: false });
    return { url: blob.url };
  },
  async delete(url) {
    if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) return;
    await del(url).catch(() => {});
  },
};

function driver(): StorageDriver {
  const name = process.env.STORAGE_DRIVER ?? (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");
  if (name === "blob") return blobDriver;
  if (name === "local") return localDriver;
  throw new Error(`Unknown STORAGE_DRIVER "${name}"`);
}

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Validates and stores an uploaded image. Throws with a user-facing message. */
export async function storeImage(file: File, folder: string): Promise<{ url: string; key: string }> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Upload a JPG, PNG or WebP image");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 2 MB or smaller");
  const data = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(data, ext)) throw new Error("That file doesn't look like a valid image");
  const key = `${folder}/${randomUUID()}.${ext}`;
  const { url } = await driver().put(key, data, file.type);
  return { url, key };
}

export function deleteStoredFile(url: string) {
  return driver().delete(url);
}

/** Checks magic bytes so a renamed file can't pose as an image. */
function matchesSignature(data: Buffer, ext: string) {
  if (ext === "jpg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (ext === "png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  return false;
}
