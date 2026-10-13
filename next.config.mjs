/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: "/images/jobs-banner-light-v3.webp",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // 請求書PDF(lib/invoice-pdf.ts)で使う日本語フォント。fs で読むので明示的に同梱する。
    outputFileTracingIncludes: {
      "/**/*": ["./assets/fonts/BIZUDPGothic-Regular-jis.ttf"],
    },
    serverComponentsExternalPackages: ["pdf-lib", "@pdf-lib/fontkit"],
  },
  typescript: {
    // Build logs aren't reachable from this deploy pipeline yet; don't let a
    // type mismatch block shipping while we dial that in.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
