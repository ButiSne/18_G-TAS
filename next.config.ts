import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Display images live in Vercel Blob (section 4 of CLAUDE.md); the archive never enters git.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
