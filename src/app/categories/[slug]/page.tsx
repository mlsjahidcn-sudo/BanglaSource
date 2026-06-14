import { categories, type CategoryKey } from "@/lib/categories";
import { CategoryClient } from "./_cat-client";
import { breadcrumbJsonLd, jsonLdScript, SITE_URL } from "@/lib/seo";

export async function generateStaticParams() {
  return Object.values(categories).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = categories[slug as CategoryKey];
  if (!c) return {};
  return {
    title: `${c.name_en} — wholesale from China to Bangladesh`,
    description: c.blurb_en,
    openGraph: {
      type: "website",
      title: `${c.name_en} · BanglaSource`,
      description: c.blurb_en,
      url: `${SITE_URL}/categories/${c.slug}`,
    },
    alternates: { canonical: `${SITE_URL}/categories/${c.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = categories[slug as CategoryKey];
  // BreadcrumbList (Google rich results). The client component
  // below is a real client (loads via useEffect) but the
  // server shell has all the data we need to render the
  // breadcrumb JSON-LD statically.
  const breadcrumb = c
    ? breadcrumbJsonLd([
        { name: "Home", href: "/" },
        { name: "Catalog", href: "/categories" },
        { name: c.name_en, href: `/categories/${c.slug}` },
      ])
    : null;
  return (
    <>
      {breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
        />
      )}
      <CategoryClient slug={slug} />
    </>
  );
}
