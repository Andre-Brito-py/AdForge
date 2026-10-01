import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/"],
        disallow: ["/api/", "/dashboard", "/campaigns", "/products", "/billing", "/credits", "/brand", "/settings", "/integrations", "/admin", "/onboarding"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
