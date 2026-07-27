import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This tells Next.js NOT to bundle yahoo-finance2, avoiding the test file errors
  serverExternalPackages: ["yahoo-finance2"],
};

export default nextConfig;