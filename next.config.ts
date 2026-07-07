import type { NextConfig } from "next";

// Empty for local dev (served at root); set to "/thor3-app" in CI so assets
// resolve under the GitHub Pages project subpath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Static HTML export for GitHub Pages (no Node server).
  output: "export",
  basePath: basePath || undefined,
  images: { unoptimized: true },
  // Note: the security headers and sw.js cache-control that used to live in
  // headers() are not supported under `output: export` (there is no server);
  // GitHub Pages serves the static files directly.
};

export default nextConfig;
