import type { MetadataRoute } from "next";

// Required for `output: export` — emit the manifest as a static file at build.
export const dynamic = "force-static";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rukr",
    short_name: "Rukr",
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
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Dedicated maskable art: lockup sits inside the center 80% safe zone
        // so Android's adaptive-icon mask never clips it.
        src: `${BASE_PATH}/icon-512-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
