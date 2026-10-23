import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sub Net Shopping",
    short_name: "Sub Net",
    description: "Shop verified supermarkets in Benin City.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#166534",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
