"use client";

/* eslint-disable @next/next/no-img-element -- product images come from runtime uploads */
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cx } from "./ui";

export function ProductGallery({ images, name }: { images: { id: string; url: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div className="space-y-3">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white p-6">
        {current ? <img src={current.url} alt={name} className="h-full w-full object-contain" /> : <ImageOff className="h-12 w-12 text-gray-300" aria-label="No image" />}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={cx("h-16 w-16 overflow-hidden rounded-xl border-2 bg-white p-1", i === index ? "border-brand-600" : "border-gray-200")}
              >
                <img src={img.url} alt="" className="h-full w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
