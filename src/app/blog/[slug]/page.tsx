// /blog/[slug] — individual post page.
//
// Phase 25. Server-rendered from /lib/blog.ts (a code-side
// content store). Adds Article JSON-LD so Google can index
// for Top Stories / Discover.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getAllPosts, getPost, type BlogPost } from "@/lib/blog";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdScript,
  SITE_URL,
} from "@/lib/seo";

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `${SITE_URL}/blog/${p.slug}` },
    openGraph: {
      type: "article",
      title: p.title,
      description: p.description,
      url: `${SITE_URL}/blog/${p.slug}`,
      publishedTime: p.publishedAt,
      modifiedTime: p.updatedAt ?? p.publishedAt,
      authors: [p.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) notFound();

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
    { name: p.title, href: `/blog/${p.slug}` },
  ]);

  const article = articleJsonLd({
    title: p.title,
    description: p.description,
    slug: p.slug,
    authorName: p.author,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />
      <Container className="pt-10 md:pt-14 pb-24">
        <div className="text-[12px] text-fg-muted mb-6 font-mono tnum">
          <Link href="/blog" className="hover:text-fg">
            blog
          </Link>
          <span className="mx-2 text-fg-subtle">/</span>
          <span className="text-fg-subtle">{p.slug}</span>
        </div>
        <article className="max-w-3xl">
          <header>
            <p className="text-[12px] uppercase tracking-wider text-fg-subtle font-medium">
              {new Date(p.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {p.readingMinutes} min read
            </p>
            <h1 className="mt-2 text-[34px] md:text-[44px] leading-[1.05] font-semibold tracking-[-0.02em]">
              {p.title}
            </h1>
            <p className="mt-4 text-[16px] text-fg-muted leading-relaxed">
              {p.description}
            </p>
          </header>

          <div className="mt-10 space-y-6 text-[15.5px] leading-[1.75] text-fg">
            {p.body.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </div>

          <hr className="mt-16 border-border" />
          <footer className="mt-6 flex items-center justify-between text-[12.5px] text-fg-muted">
            <p>
              By <span className="font-medium text-fg">{p.author}</span>
            </p>
            <Link
              href="/blog"
              className="text-cyan-700 hover:underline"
            >
              ← All posts
            </Link>
          </footer>
        </article>
      </Container>
    </>
  );
}

function Block({ block }: { block: BlogPost["body"][number] }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-12 text-[24px] font-semibold tracking-[-0.01em] text-fg">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-8 text-[19px] font-semibold tracking-[-0.005em] text-fg">
          {block.text}
        </h3>
      );
    case "p":
      return <p>{block.text}</p>;
    case "ul":
      return (
        <ul className="list-disc pl-6 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-6 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <aside
          className={`rounded-lg border p-4 ${
            block.tone === "warn"
              ? "border-amber-200 bg-amber-50/60"
              : "border-cyan-200 bg-cyan-50/60"
          }`}
        >
          <p
            className={`text-[13px] leading-relaxed ${
              block.tone === "warn" ? "text-amber-900" : "text-cyan-900"
            }`}
          >
            {block.text}
          </p>
        </aside>
      );
    case "code":
      return (
        <pre className="bg-bg-soft border border-border rounded-md p-4 overflow-x-auto text-[12.5px] font-mono">
          {block.text}
        </pre>
      );
    default:
      return null;
  }
}
