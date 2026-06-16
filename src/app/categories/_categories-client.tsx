"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/lib/use-catalog";
import { categoryList } from "@/lib/categories";

export function CategoriesIndexClient() {
  const { t, lang } = useLang();
  const { products: allProducts, loaded } = useCatalog();
  if (!loaded) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }
  return (
    <>
      <Container className="pt-16 md:pt-20 pb-12">
        <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
          Catalog
        </p>
        <h1 className="mt-3 text-[40px] md:text-[52px] leading-[1.05] font-semibold tracking-[-0.02em]">
          {t("cat.title")}
        </h1>
        <p className="mt-4 text-[16px] text-fg-muted max-w-2xl">
          {lang === "bn"
            ? `${categoryList.length}টি সোর্সিং ক্যাটাগরি, বাংলাদেশের বাজারের জন্য বাছাই করা।`
            : `${categoryList.length} sourcing categories, hand-picked for the Bangladesh market.`}
        </p>
      </Container>

      <Container className="pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categoryList.map((c) => {
            const count = allProducts.filter((p) => p.category === c.key).length;
            const fromPrice = Math.min(
              ...allProducts
                .filter((p) => p.category === c.key)
                .map((p) => p.price_tiers[p.price_tiers.length - 1].price_cny_fen),
            ) / 100;
            return (
              <Link
                key={c.key}
                href={`/categories/${c.slug}`}
                className="card group p-6 hover:border-border-strong"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${c.accent} mb-5`} />
                <h3 className="text-[17px] font-semibold tracking-tight">
                  {lang === "bn" ? c.name_bn : c.name_en}
                </h3>
                <p className="mt-1.5 text-[13px] text-fg-muted line-clamp-2 min-h-[2.6em]">
                  {lang === "bn" ? c.blurb_bn : c.blurb_en}
                </p>
                <div className="mt-6 pt-5 border-t border-border flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
                      Products
                    </p>
                    <p className="price-tag text-[15px] font-medium mt-0.5">
                      {count}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
                      From
                    </p>
                    <p className="price-tag text-[15px] font-medium mt-0.5">
                      ¥{fromPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>

      <Container className="pb-24">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-[24px] font-semibold tracking-tight">
            All products
          </h2>
          <p className="text-[12px] text-fg-subtle font-mono tnum">
            {allProducts.length} listed
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {allProducts.map((p) => (
            <ProductCard
              key={p.source_id}
              product={p as unknown as Parameters<typeof ProductCard>[0]["product"]}
            />
          ))}
        </div>
      </Container>
    </>
  );
}
