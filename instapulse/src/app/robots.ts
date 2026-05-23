import { MetadataRoute } from "next";

// Disallow all crawlers — this deployment is for private testing only.
// Remove this file before any public launch.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
