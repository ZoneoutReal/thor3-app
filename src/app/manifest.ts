import type { MetadataRoute } from "next";

// Required for `output: export` — emit the manifest as a static file at build.
export const dynamic = "force-static";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "THOR3 Trainer",
    short_name: "THOR3",
    description: "SFAS Conditioning Program Tracker",
    id: `${BASE_PATH}/`,
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#111113",
    theme_color: "#111113",
    orientation: "portrait",
    icons: [
      {
        src: `${BASE_PATH}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
