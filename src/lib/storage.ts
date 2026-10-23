import "server-only";
// File storage for logos and product images (PRD §8: images live in
// storage, the database keeps only the URL and key). The local driver
// writes to UPLOAD_DIR (default ./uploads) and files are served by
// app/uploads/[...key]/route.ts. Production on multiple instances should
// add an object-storage driver (S3, R2, Cloudinary…) implementing
// StorageDriver and select it with STORAGE_DRIVER.
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

export const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));

const localDriver: StorageDriver = {
  async put(key, data) {
    const file = path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { url: `/uploads/${key}` };
  },
  async delete(key) {
    await unlink(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, key)).catch(() => {});
  },
};

function driver(): StorageDriver {
  const name = process.env.STORAGE_DRIVER ?? "local";
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

export function deleteStoredFile(key: string) {
  return driver().delete(key);
}

/** Checks magic bytes so a renamed file can't pose as an image. */
function matchesSignature(data: Buffer, ext: string) {
  if (ext === "jpg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (ext === "png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  return false;
}

/** Storage key for a URL produced by the local driver, if any. */
export function keyFromUrl(url: string | null): string | null {
  return url?.startsWith("/uploads/") ? url.slice("/uploads/".length) : null;
}
