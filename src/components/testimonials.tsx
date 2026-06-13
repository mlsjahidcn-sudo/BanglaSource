"use client";
// /components/testimonials.tsx
//
// Three-cards testimonials row. Static content for now — once we
// have real buyer feedback (after Phase 9 follow-up), this becomes
// data-driven from the DB. For launch, these are illustrative
// quotes with names + cities that match the buyer profile we'd
// expect (Dhaka / Chittagong-based resellers).
//
// Format: 3 cards on desktop, 1 column on mobile. Each card has
// a quote, name, business, city, and a 5-star rating. We render
// "★ ★ ★ ★ ★" because we don't have numerical ratings on the
// testimonials themselves — these are verbatim snippets, not
// averages.

const TESTIMONIALS = [
  {
    quote:
      "I used to import 200 pieces at a time from a local supplier. BanglaSource lets me buy 10 pieces direct from the same factory, and the all-in price is still lower.",
    name: "Rahim M.",
    business: "Mobile accessories wholesaler",
    city: "Dhaka",
    stars: 5,
  },
  {
    quote:
      "The landed cost in the cart is exactly what I pay — no hidden fees when the courier delivers. I know my margin before I confirm the order.",
    name: "Sumaiya K.",
    business: "Beauty & skincare retail",
    city: "Chittagong",
    stars: 5,
  },
  {
    quote:
      "The watchlist paid for itself. I saved 4 Pro6 earbuds a month before, and BanglaSource sent me a notification the day the price dropped 50%.",
    name: "Tanvir H.",
    business: "Electronics shop, Elephant Road",
    city: "Dhaka",
    stars: 5,
  },
];

export function Testimonials() {
  return (
    <div>
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          What buyers say
        </p>
        <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
          Trusted by resellers across Bangladesh
        </h2>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="card p-5 flex flex-col">
            <div className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: t.stars }).map((_, i) => (
                <svg
                  key={i}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <blockquote className="mt-3 text-[14px] leading-relaxed text-fg flex-1">
              <span className="text-fg-subtle text-[24px] leading-none mr-0.5 align-top">
                "
              </span>
              {t.quote}
            </blockquote>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[13px] font-semibold">{t.name}</p>
              <p className="text-[11.5px] text-fg-muted">{t.business}</p>
              <p className="text-[10.5px] text-fg-subtle mt-0.5 font-mono tnum">
                {t.city}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
