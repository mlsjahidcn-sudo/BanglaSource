"use client";
import { notFound } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/lib/use-catalog";
import { categories, type CategoryKey } from "@/lib/categories";

export function CategoryClient({ slug }: { slug: string }) {
  const { lang } = useLang();
  const { products: allProducts, loaded } = useCatalog();
  const c = categories[slug as CategoryKey];
  if (!c) {
    notFound();
  }
  if (!loaded) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }
  const items = allProducts.filter((p) => p.category === c.key);
  return (
    <>
      <Container className="pt-14 md:pt-20 pb-12">
        <nav className="text-[12px] text-fg-subtle mb-6 font-mono tnum">
          <a href="/categories" className="hover:text-fg">
            catalog
          </a>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-fg-muted">{c.slug}</span>
        </nav>
        <div className="flex items-end gap-3">
          <div className={`w-1.5 h-1.5 rounded-full ${c.accent} mb-3`} />
          <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
            Category
          </p>
        </div>
        <h1 className="mt-3 text-[40px] md:text-[52px] leading-[1.05] font-semibold tracking-[-0.02em]">
          {lang === "bn" ? c.name_bn : c.name_en}
        </h1>
        <p className="mt-4 text-[16px] text-fg-muted max-w-2xl leading-relaxed">
          {lang === "bn" ? c.blurb_bn : c.blurb_en}
        </p>
        <div className="mt-7 flex items-center gap-6 text-[12px] text-fg-subtle">
          <span className="font-mono tnum">
            <span className="text-fg font-medium price-tag text-[14px] mr-1">
              {items.length}
            </span>
            products
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Sourced from verified factories in{" "}
            {Array.from(new Set(items.map((p) => p.supplier_province))).join(", ")}
          </span>
        </div>
      </Container>
      <Container className="pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProductCard key={p.source_id} product={p} />
          ))}
        </div>
      </Container>
    </>
  );
}
