import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // Säkerställ att kundrapportens HTML buntas med route-funktionen på Vercel.
  outputFileTracingIncludes: {
    "/sakerhetsarenan": ["./app/sakerhetsarenan/content.html"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.prod.website-files.com; img-src 'self' https: data:; font-src 'self' https://cdn.prod.website-files.com; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
