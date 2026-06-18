import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProductDetail } from "@/components/product-detail";
import { RecommendationsCarousel } from "@/components/recommendations-carousel";
import { ForYou } from "@/components/for-you";
import { SameFactory } from "@/components/same-factory";
import { ProductCarousel } from "@/components/product-carousel";
import { getCatalog, getProduct, dbProductToLegacy, publicProduct } from "@/lib/catalog";
import { categories } from "@/lib/categories";
import { FX_CNY_BDT } from "@/lib/pricing";
import {
  breadcrumbJsonLd,
  jsonLdScript,
  SITE_URL,
} from "@/lib/seo";
import { similarProducts, sameFactoryItems } from "@/lib/popular";

const SITE = SITE_URL;

type Params = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  try {
    const rows = await getCatalog();
    return rows.map((p) => ({ id: p.source_id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return {};
  const lowestPriceCny = p.price_tiers.length
    ? Math.min(...p.price_tiers.map((t) => t.price_cny_fen)) / 100
    : 0;
  return {
    title: `${p.title_en} · from ¥${lowestPriceCny.toFixed(2)}`,
    description: p.description_en,
    alternates: { canonical: `${SITE_URL}/products/${p.source_id}` },
    openGraph: {
      type: "website",
      title: p.title_en,
      description: p.description_en,
      images: p.images?.[0] ? [{ url: p.images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { id } = await params;
  const db = await getProduct(id);
  if (!db) notFound();

  const cat = categories[db.category as keyof typeof categories];
  // Phase 56: strip supplier identity before passing to the
  // client component. The full data stays in db (used server-
  // side for same-factory matching + JSON-LD construction) but
  // the client only sees the public-safe shape.
  const product = publicProduct(dbProductToLegacy(db));

  // Build Product JSON-LD for Google rich results
  const lowestTier = db.price_tiers.reduce(
    (a, b) => (a.price_cny_fen < b.price_cny_fen ? a : b),
    db.price_tiers[0],
  );
  const priceUsd = ((lowestTier.price_cny_fen / 100) * 0.14).toFixed(2);
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: db.title_en,
    description: db.description_en,
    image: db.images?.slice(0, 4) ?? [],
    sku: db.source_id,
    mpn: db.source_id,
    // The brand shown to search engines is BanglaSource — we are
    // the seller of record, not the factory. Exposing the factory
    // name in the JSON-LD would let a buyer bypass us and order
    // direct from the source.
    brand: { "@type": "Brand", name: "BanglaSource" },
    category: cat?.name_en ?? db.category,
    offers: {
      "@type": "Offer",
      url: `${SITE}/products/${db.source_id}`,
      priceCurrency: "CNY",
      price: (lowestTier.price_cny_fen / 100).toFixed(2),
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "BanglaSource",
      },
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        minValue: lowestTier.qty_min,
        maxValue: lowestTier.qty_max ?? undefined,
        unitText: "pcs",
      },
    },
    // Geographic source — for SEO differentiation
    countryOfOrigin: { "@type": "Country", name: "China" },
  };

  // BreadcrumbList (Google rich results) — Home > Category > Product
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Catalog", href: "/categories" },
    ...(cat
      ? [
          {
            name: cat.name_en,
            href: `/categories/${cat.slug}`,
          },
        ]
      : []),
    { name: db.title_en, href: `/products/${db.source_id}` },
  ]);

  // Phase 23: similar products (same category + same
  // supplier ±30% price band). Loaded in parallel with
  // the page render. Empty list is fine — we just
  // hide the carousel. (Note: `lowestTier` is already
  // computed above for the JSON-LD Offer; we reuse it.)
  const currentMinBdt = lowestTier
    ? Math.ceil((lowestTier.price_cny_fen / 100) * FX_CNY_BDT)
    : 0;
  const similar = await similarProducts(
    db.category,
    db.supplier_name ?? "",
    currentMinBdt,
    db.source_id,
    10,
  ).catch(() => []);

  // Same-factory items, server-side. The supplier name is
  // matched in SQL but never rendered or returned to the
  // client (we only ship title/image/price/MOQ down).
  const sameFactory = await sameFactoryItems(
    db.supplier_name ?? "",
    db.source_id,
    8,
  ).catch(() => []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />
      <Container className="pt-10 md:pt-14 pb-24">
        {/* Breadcrumbs */}
        <nav className="text-[12px] text-fg-subtle mb-6 font-mono tnum">
          <a href="/categories" className="hover:text-fg">
            catalog
          </a>
          <span className="mx-2 text-slate-300">/</span>
          {cat && (
            <>
              <a href={`/categories/${cat.slug}`} className="hover:text-fg">
                {cat.slug}
              </a>
              <span className="mx-2 text-slate-300">/</span>
            </>
          )}
          <span className="text-fg-muted">{db.source_id}</span>
        </nav>
        <ProductDetail
          product={
            product as unknown as Parameters<typeof ProductDetail>[0]["product"]
          }
        />
        <SameFactory items={sameFactory} />
        {/* Phase 23: same-category ± price-band + same-
            supplier candidates. Falls back silently if
            the query returns empty. */}
        {similar.length > 0 && (
          <ProductCarousel
            eyebrow="You might also like"
            title="Similar products"
            items={similar}
            hrefAll={`/categories/${cat?.slug ?? db.category}`}
            hrefAllLabel={`Browse all ${cat?.name_en ?? db.category} →`}
          />
        )}
        <RecommendationsCarousel productId={db.source_id} />
        <ForYou limit={8} title="More for you" eyebrow="Personalized" className="mt-12" />
      </Container>
    </>
  );
}
