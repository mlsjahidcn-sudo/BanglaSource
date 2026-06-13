"use client";
// /components/value-props.tsx
//
// "Why BanglaSource" comparison table — the strongest conversion
// asset on the home page. Three columns: BanglaSource vs
// Direct 1688 vs Local Importer. Buyers in Bangladesh often
// compare these three; this side-by-side answer removes the
// comparison from their head.

import Link from "next/link";

const ROWS = [
  {
    feature: "All-in price in BDT",
    bs: "✓ One landed price, no surprises",
    direct: "✗ FOB only; you handle shipping, duty, VAT",
    local: "✓ Quoted in BDT but 30–60% markup",
  },
  {
    feature: "Quantity flexibility",
    bs: "✓ Buy 1 pc to bulk",
    direct: "✗ MOQ usually 50+ pcs per order",
    local: "✗ Often 100+ pcs per SKU",
  },
  {
    feature: "Quality verified",
    bs: "✓ Trade-assurance + manual review",
    direct: "✗ 1688 quality varies wildly",
    local: "✓ Usually pre-checked",
  },
  {
    feature: "Customization & samples",
    bs: "✓ Source-on-demand, sample before bulk",
    direct: "✗ Negotiate in Chinese",
    local: "✗ Limited selection",
  },
  {
    feature: "Shipping to Dhaka",
    bs: "✓ Air/sea calculated live, door-to-door",
    direct: "✗ You find a freight forwarder",
    local: "✓ Already in Dhaka, you pick up",
  },
  {
    feature: "Payment in BDT",
    bs: "✓ bKash, Nagad, bank transfer",
    direct: "✗ Wire USD to a Chinese bank",
    local: "✓ bKash / bank",
  },
  {
    feature: "Real-time price tracking",
    bs: "✓ Watchlist + price-drop alerts",
    direct: "✗ DIY spreadsheet",
    local: "✗ Whatever they quote you",
  },
];

export function ValueProps() {
  return (
    <div>
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          How we compare
        </p>
        <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
          BanglaSource vs the alternatives
        </h2>
        <p className="mt-2 text-[14px] text-fg-muted">
          Same product. Same factory. Three different ways to get it.
          Here's what changes.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-border overflow-hidden bg-bg">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="text-left p-4 font-semibold w-[26%]">
                  What you get
                </th>
                <th className="text-left p-4 font-semibold w-[24%]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    BanglaSource
                  </span>
                </th>
                <th className="text-left p-4 font-semibold text-fg-muted w-[25%]">
                  1688 + freight forwarder
                </th>
                <th className="text-left p-4 font-semibold text-fg-muted w-[25%]">
                  Local Dhaka importer
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.feature}
                  className={i % 2 === 0 ? "bg-bg" : "bg-slate-50/50"}
                >
                  <td className="p-4 font-medium align-top">{r.feature}</td>
                  <td className="p-4 align-top text-fg">{r.bs}</td>
                  <td className="p-4 align-top text-fg-muted">{r.direct}</td>
                  <td className="p-4 align-top text-fg-muted">{r.local}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/how-it-works"
          className="h-10 inline-flex items-center px-4 text-[13px] font-medium rounded-md border border-border text-fg hover:bg-slate-50"
        >
          How it works
        </Link>
        <Link
          href="/categories"
          className="h-10 inline-flex items-center px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
        >
          Browse 166 products →
        </Link>
      </div>
    </div>
  );
}
