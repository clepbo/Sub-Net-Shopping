import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sub Net Shopping",
    short_name: "Sub Net",
    description: "Shop verified supermarkets in Benin City.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#014b4e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
