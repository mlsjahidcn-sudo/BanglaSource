"use client";
import { Container } from "@/components/ui/container";
import { ProductPriceCalc } from "@/components/product-price-calc";
import { useLang } from "@/lib/i18n";
import {
  AIR_TIERS_PUBLIC,
  AIR_MIN_LADDER_PUBLIC,
  EXPRESS_TIERS_PUBLIC,
  EXPRESS_MIN_LADDER_PUBLIC,
  SEA_RATES_PUBLIC,
  SIDE_SERVICE_RATES_PUBLIC,
  FX_CNY_BDT,
} from "@/lib/pricing";

/** Format the upper-bound of a tier like "Up to 2 kg" or "Above 50 kg". */
function formatTierBound(maxKg: number, isFirst: boolean, isLast: boolean) {
  if (isLast) return "Above 50 kg";
  if (maxKg === Infinity) return "Above 50 kg";
  if (isFirst) return `Up to ${maxKg} kg`;
  return `${maxKg === 0.2 ? "0.2" : maxKg} kg`;
}

export function ShippingClient() {
  const { t } = useLang();

  return (
    <>
      {/* Hero */}
      <Container className="pt-16 md:pt-20 pb-10">
        <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
          Logistics
        </p>
        <h1 className="mt-3 text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-[-0.02em] max-w-3xl">
          {t("ship.title")}
        </h1>
        <p className="mt-5 text-[17px] text-fg-muted max-w-2xl leading-relaxed">
          {t("ship.subtitle")}
        </p>
        <p className="mt-3 text-[13px] text-fg-subtle max-w-2xl leading-relaxed">
          {t("ship.fx_note")}
          <span className="ml-1 font-mono tnum">
            (FX {FX_CNY_BDT.toFixed(2)})
          </span>
        </p>
      </Container>

      {/* Air + Sea + Express side-by-side cards */}
      <Container className="pb-12">
        <div className="grid md:grid-cols-3 gap-5">
          {/* Air */}
          <ModeCard
            name={t("ship.mode.air")}
            transit={t("ship.transit.air")}
            bestFor={t("ship.best_for.air")}
            tierTitle={t("ship.tier_table.title")}
            tiers={AIR_TIERS_PUBLIC.map((tier, i) => ({
              bound: formatTierBound(tier.maxKg, i === 0, i === AIR_TIERS_PUBLIC.length - 1),
              perKg: tier.rateBdtPerKg,
            }))}
            floorTitle={t("ship.floor_table.title")}
            floors={AIR_MIN_LADDER_PUBLIC.map((floor) => ({
              bound: `≤ ${floor.maxKg} kg`,
              min: floor.minBdt,
            }))}
            accent="cyan"
          />

          {/* Express */}
          <ModeCard
            name={t("ship.mode.express")}
            transit={t("ship.transit.express")}
            bestFor={t("ship.best_for.express")}
            tierTitle={t("ship.tier_table.title")}
            tiers={EXPRESS_TIERS_PUBLIC.map((tier, i) => ({
              bound: formatTierBound(tier.maxKg, i === 0, i === EXPRESS_TIERS_PUBLIC.length - 1).replace("50 kg", "20 kg").replace("Above 50", "Above 20"),
              perKg: tier.rateBdtPerKg,
            }))}
            floorTitle={t("ship.floor_table.title")}
            floors={EXPRESS_MIN_LADDER_PUBLIC.map((floor) => ({
              bound: `≤ ${floor.maxKg} kg`,
              min: floor.minBdt,
            }))}
            accent="violet"
          />

          {/* Sea */}
          <div className="rounded-lg border border-border bg-bg p-6 flex flex-col">
            <p className="text-[11px] uppercase tracking-wider font-medium text-emerald-700">
              {t("ship.mode.sea")}
            </p>
            <p className="mt-2 text-[20px] font-semibold tracking-tight">
              ৳{SEA_RATES_PUBLIC.bdtPerCbm.toLocaleString()} / CBM
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Floor ৳{SEA_RATES_PUBLIC.minBdt.toLocaleString()} (= 0.15 CBM)
            </p>

            <dl className="mt-5 space-y-2 text-[12.5px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-muted">Transit</dt>
                <dd className="font-mono tnum">{t("ship.transit.sea")}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-muted">Best for</dt>
                <dd className="text-fg-muted text-right max-w-[140px] text-[11.5px]">
                  {t("ship.best_for.sea")}
                </dd>
              </div>
            </dl>

            <p className="mt-4 pt-4 border-t border-border text-[11.5px] text-fg-muted leading-relaxed">
              {t("ship.sea.note")}
            </p>
          </div>
        </div>
      </Container>

      {/* Side services */}
      <Container className="pb-12">
        <div className="max-w-5xl">
          <h2 className="text-[20px] font-semibold tracking-tight">
            {t("ship.sides.title")}
          </h2>
          <p className="mt-1.5 text-[13.5px] text-fg-muted max-w-2xl">
            {t("ship.sides.intro")}
          </p>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <SideServiceCard
              title={t("ship.sides.cn_domestic")}
              help={t("ship.sides.cn_domestic_help")}
              rate={`৳${SIDE_SERVICE_RATES_PUBLIC.cnDomestic.bdtPerKg.toLocaleString()}/kg`}
              floor={`Floor ৳${SIDE_SERVICE_RATES_PUBLIC.cnDomestic.minBdt.toLocaleString()}`}
            />
            <SideServiceCard
              title={t("ship.sides.agent")}
              help={t("ship.sides.agent_help")}
              rate={`${(SIDE_SERVICE_RATES_PUBLIC.agent.pct * 100).toFixed(0)}% of FOB`}
              floor={`Floor ৳${SIDE_SERVICE_RATES_PUBLIC.agent.minBdt.toLocaleString()}`}
            />
            <SideServiceCard
              title={t("ship.sides.consol")}
              help={t("ship.sides.consol_help")}
              rate={`৳${SIDE_SERVICE_RATES_PUBLIC.consol.bdtPerOrder.toLocaleString()} / order`}
              floor="Multi-supplier only"
            />
          </div>
        </div>
      </Container>

      {/* Product price estimator */}
      <Container className="pb-12">
        <div className="max-w-5xl">
          <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
            Estimator
          </p>
          <h2 className="mt-3 text-[28px] md:text-[36px] leading-tight font-semibold tracking-[-0.02em]">
            Product price
          </h2>
          <p className="mt-3 text-fg-muted max-w-2xl">
            What you see as the buyer-facing product price (factory FOB +
            company margin). Shipping + duty + tax settle to the courier
            on delivery — see the 3 mode cards above for per-kg rates.
          </p>
          <div className="mt-8">
            <ProductPriceCalc />
          </div>
        </div>
      </Container>

      {/* Things to know */}
      <Container className="pb-24">
        <div className="max-w-4xl">
          <h2 className="text-[20px] font-semibold tracking-tight">
            {t("ship.disclaimer.title")}
          </h2>
          <ul className="mt-5 space-y-4 text-[14px] text-fg-muted leading-relaxed max-w-3xl">
            <li className="flex gap-3">
              <span className="text-emerald-600 shrink-0">→</span>
              {t("ship.disclaimer.1")}
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-600 shrink-0">→</span>
              {t("ship.disclaimer.2")}
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-600 shrink-0">→</span>
              {t("ship.disclaimer.3")}
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-600 shrink-0">→</span>
              {t("ship.disclaimer.4")}
            </li>
          </ul>
        </div>
      </Container>
    </>
  );
}

function ModeCard({
  name,
  transit,
  bestFor,
  tierTitle,
  tiers,
  floorTitle,
  floors,
  accent,
}: {
  name: string;
  transit: string;
  bestFor: string;
  tierTitle: string;
  tiers: Array<{ bound: string; perKg: number }>;
  floorTitle: string;
  floors: Array<{ bound: string; min: number }>;
  accent: "cyan" | "violet";
}) {
  const accentBorder =
    accent === "cyan" ? "border-cyan-200" : "border-violet-200";
  const accentText = accent === "cyan" ? "text-cyan-700" : "text-violet-700";
  const accentBg = accent === "cyan" ? "bg-cyan-50" : "bg-violet-50";

  return (
    <div className={`rounded-lg border ${accentBorder} bg-bg p-6 flex flex-col`}>
      <p
        className={`text-[11px] uppercase tracking-wider font-medium ${accentText}`}
      >
        {name}
      </p>
      <p className="mt-2 text-[20px] font-semibold tracking-tight">
        {tiers[tiers.length - 1].perKg.toLocaleString()} ৳ / kg
      </p>
      <p className="mt-1 text-[12px] text-fg-muted">
        best tier (heaviest). Smaller parcels pay more.
      </p>

      <dl className="mt-5 space-y-2 text-[12.5px]">
        <div className="flex items-baseline justify-between">
          <dt className="text-fg-muted">Transit</dt>
          <dd className="font-mono tnum">{transit}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-fg-muted">Best for</dt>
          <dd className="text-fg-muted text-right max-w-[140px] text-[11.5px]">
            {bestFor}
          </dd>
        </div>
      </dl>

      <div className="mt-5 pt-4 border-t border-border">
        <p className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle">
          {tierTitle}
        </p>
        <ul className="mt-2 space-y-1.5 text-[12.5px]">
          {tiers.map((tier, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between font-mono tnum"
            >
              <span className="text-fg-muted">{tier.bound}</span>
              <span>৳{tier.perKg.toLocaleString()} / kg</span>
            </li>
          ))}
        </ul>
      </div>

      {floors.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10.5px] uppercase tracking-wider font-medium text-fg-subtle">
            {floorTitle}
          </p>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">
            {floors.map((floor, i) => (
              <li
                key={i}
                className={`flex items-baseline justify-between font-mono tnum px-2 py-1 rounded ${accentBg}`}
              >
                <span className="text-fg-muted">{floor.bound}</span>
                <span>min ৳{floor.min.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SideServiceCard({
  title,
  help,
  rate,
  floor,
}: {
  title: string;
  help: string;
  rate: string;
  floor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <p className="text-[14px] font-semibold tracking-tight">{title}</p>
      <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{help}</p>
      <p className="mt-3 text-[13.5px] font-mono tnum text-fg">{rate}</p>
      <p className="mt-0.5 text-[11px] text-fg-subtle">{floor}</p>
    </div>
  );
}
