// /lib/seo.ts
//
// Phase 25: JSON-LD builders + small SEO helpers. Used
// directly by the page-level scripts (PDP, category,
// home). Keep this file free of server-only imports —
// the page components inline the JSON via
// `dangerouslySetInnerHTML`, and the builders must be
// usable from a Server Component.

export const SITE_URL = "https://banglasource.com";
export const SITE_NAME = "BanglaSource";
export const SITE_DESCRIPTION =
  "Wholesale from 1688 / Pinduoduo / Taobao factories to Bangladesh. Air, sea, and full BD customs duty included in the landed cost. Pre-pay 100% at order confirm — no balance on delivery.";

/**
 * Build a BreadcrumbList JSON-LD object. The same shape
 * is used on PDPs and category pages. Items are
 * appended in order (left = root, right = current).
 */
export function breadcrumbJsonLd(
  items: { name: string; href: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.href.startsWith("http")
        ? it.href
        : `${SITE_URL}${it.href.startsWith("/") ? "" : "/"}${it.href}`,
    })),
  };
}

/**
 * Organization JSON-LD. Used on the home page so Google
 * has a single canonical entity to attach sitelinks /
 * search-box / knowledge-panel data to.
 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: SITE_DESCRIPTION,
    sameAs: [
      // Public-facing links. Keep these in sync with
      // wherever the brand lives. The user has no
      // social profiles wired yet — these are stubs
      // for future expansion.
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `${SITE_URL}/contact`,
        availableLanguage: ["en", "bn"],
      },
    ],
    areaServed: [
      { "@type": "Country", name: "Bangladesh" },
    ],
    knowsAbout: [
      "Wholesale sourcing",
      "1688 / Alibaba",
      "Bangladesh import",
      "Air freight consolidation",
      "Sea LCL shipping",
      "BD customs duty",
    ],
  };
}

/**
 * Website JSON-LD with a SearchAction. Used on the
 * home page so Google can show a sitelinks search box.
 */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      // The literal placeholders Google needs:
      // `query-input` MUST be exactly "required name=search_term_string"
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Article JSON-LD for /blog/[slug] pages. Helps Google
 * index posts for the Top Stories / Discover carousel.
 */
export function articleJsonLd({
  title,
  description,
  slug,
  authorName = SITE_NAME,
  publishedAt,
  updatedAt,
  imageUrl,
}: {
  title: string;
  description: string;
  slug: string;
  authorName?: string;
  publishedAt: string;
  updatedAt?: string;
  imageUrl?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl ? [imageUrl] : [`${SITE_URL}/og-default.png`],
    datePublished: publishedAt,
    dateModified: updatedAt ?? publishedAt,
    author: {
      "@type": "Organization",
      name: authorName,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${slug}`,
    },
  };
}

/**
 * Serialize a JSON-LD object for the `script` tag.
 * JSON.stringify escapes `<` and `>` already; the
 * `</script>` injection vector is blocked because
 * `</` would never appear unescaped in a JSON value
 * that only contains primitives + objects/arrays.
 */
export function jsonLdScript(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}
