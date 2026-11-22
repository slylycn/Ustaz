import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Picks up ./i18n/request.ts by default.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // mammoth (DOCX → text) runs only on the server; load it from node_modules instead of bundling.
  serverExternalPackages: ["mammoth"],
  // lib/aqylbek.ts reads the system prompt from disk at runtime; ship it with every server function.
  outputFileTracingIncludes: {
    "/**": ["./lib/prompts/**/*"],
  },
  // Public parent pages: never indexed, never cached, and the token never leaks via Referer.
  async headers() {
    return [
      {
        source: "/p/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
