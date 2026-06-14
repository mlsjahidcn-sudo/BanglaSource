// /blog — public index of all blog posts.
//
// Phase 25: SEO content surface. The two posts in /lib/blog.ts
// target the two highest-intent Bangladesh import queries
// ("bangladesh customs duty import from china" and "how to
// import from China to bangladesh"). Each post is rendered
// with Article JSON-LD on its own page; this index just
// links to them.

import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getAllPosts } from "@/lib/blog";
import {
  jsonLdScript,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: `Blog`,
  description: `Import guides, customs-duty deep dives, and supplier tips for wholesalers buying from China to Bangladesh. ${SITE_DESCRIPTION}`,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    title: `Blog · ${SITE_NAME}`,
    description: `Import guides, customs-duty deep dives, and supplier tips for wholesalers buying from China to Bangladesh.`,
    url: `${SITE_URL}/blog`,
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  // CollectionPage JSON-LD so Google can render the blog
  // as a "site links" entry + accept the rss feed format.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Blog · ${SITE_NAME}`,
    description: `Import guides, customs-duty deep dives, and supplier tips for wholesalers buying from China to Bangladesh.`,
    url: `${SITE_URL}/blog`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    hasPart: posts.map((p) => ({
      "@type": "Article",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt,
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <Container className="pt-10 md:pt-14 pb-24">
      <header className="max-w-3xl">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Field notes
        </p>
        <h1 className="mt-2 text-[36px] md:text-[44px] leading-[1.05] font-semibold tracking-[-0.02em]">
          The BanglaSource blog
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
          Import guides, customs-duty deep dives, supplier
          spotlights, and the 2-3 things that went wrong
          this month. Written for new wholesalers buying
          from China to Bangladesh — no jargon, no SEO
          filler.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="card p-6 block hover:border-cyan-300 transition-colors h-full"
            >
              <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
                {new Date(p.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {p.readingMinutes} min read
              </p>
              <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.005em] leading-snug">
                {p.title}
              </h2>
              <p className="mt-2 text-[13px] text-fg-muted leading-relaxed">
                {p.description}
              </p>
              <p className="mt-4 text-[12px] text-cyan-700 font-medium">
                Read more →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
    </>
  );
}
