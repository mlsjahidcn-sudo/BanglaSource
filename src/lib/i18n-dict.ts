// Plain types and functions usable from both server and client components.
// No "use client" — safe to import from RSC.

export type Lang = "en" | "bn";

type Dict = Record<string, { en: string; bn: string }>;

export const dict: Dict = {
  // ── Nav ────────────────────────────────────────────────────────────
  "nav.catalog": { en: "Catalog", bn: "ক্যাটালগ" },
  "nav.how": { en: "How it works", bn: "কীভাবে কাজ করে" },
  "nav.shipping": { en: "Shipping rates", bn: "শিপিং চার্জ" },
  "nav.about": { en: "About", bn: "সম্পর্কে" },
  "nav.contact": { en: "Contact", bn: "যোগাযোগ" },
  "nav.group_buys": { en: "Group buys", bn: "গ্রুপ বায়" },
  "nav.signin": { en: "Sign in", bn: "সাইন ইন" },
  "nav.start_order": { en: "Start an order", bn: "অর্ডার শুরু করুন" },
  "nav.all_categories": { en: "All categories", bn: "সব ক্যাটাগরি" },
  "nav.my_account": { en: "My account", bn: "আমার অ্যাকাউন্ট" },
  "nav.blog": { en: "Blog", bn: "ব্লগ" },
  "nav.lang": { en: "Language", bn: "ভাষা" },
  "nav.search_placeholder": {
    en: "Search products · TWS earbuds, sunglasses, handbags…",
    bn: "পণ্য খুঁজুন · TWS ইয়ারবাড, সানগ্লাস, হ্যান্ডব্যাগ…",
  },

  // ── Home: single-slide hero (Phase 26, hand-picked since 2026-06-15) ──
  // Eyebrow no longer references 1688 or live sync — we hand-pick.
  "home.hero.eyebrow": {
    en: "Verified supplier · {count} products in stock",
    bn: "যাচাইকৃত সরবরাহকারী · {count}টি পণ্য স্টকে",
  },
  "home.hero.title": {
    en: "Bulk wholesale, all-in BDT pricing.",
    bn: "পাইকারি আমদানি, সম্পূর্ণ বিডিটি মূল্যে।",
  },
  "home.hero.subhead": {
    en: "Hand-picked by our China team. Factory price, air or sea freight, Bangladesh customs duty, VAT, and agent fee — combined into one transparent BDT unit price. No hidden markups, no FX surprises.",
    bn: "আমাদের চীনা টিম সাবধানে বাছাই করেছে। কারখানা মূল্য, এয়ার বা সি ফ্রেইট, বাংলাদেশ কাস্টমস ডিউটি, ভ্যাট এবং এজেন্ট ফি — সব একটি স্বচ্ছ বিডিটি ইউনিট মূল্যে। কোনো লুকানো মার্কআপ নেই, কোনো এফএক্স চমক নেই।",
  },
  "home.hero.cta.browse": { en: "Browse {count} products", bn: "{count}টি পণ্য দেখুন" },
  "home.hero.cta.quote": { en: "Request a quote", bn: "কোটেশন চান" },

  // ── Phase 52: hero slider (product-specific slides) ────────
  "home.hero_slider.eyebrow": {
    en: "Featured · popular this week",
    bn: "বিশেষ · এই সপ্তাহের জনপ্রিয়",
  },
  "home.hero_slider.cta.view": { en: "View product", bn: "পণ্য দেখুন" },
  "home.hero_slider.from": { en: "from", bn: "থেকে" },
  "home.hero_slider.per_pc": { en: "/ pc at {qty}+", bn: "/ পিস {qty}+ এ" },
  "home.hero_slider.shipping": {
    en: "Air 7-12 days · Sea 30-45 days",
    bn: "এয়ার ৭-১২ দিন · সি ৩০-৪৫ দিন",
  },
  "home.hero_slider.prev": { en: "Previous slide", bn: "আগের স্লাইড" },
  "home.hero_slider.next": { en: "Next slide", bn: "পরের স্লাইড" },
  "home.hero_slider.slide_of": {
    en: "Slide {n} of {total}",
    bn: "{total} এর {n} নম্বর স্লাইড",
  },
  "home.hero_slider.empty": {
    en: "Featured products loading…",
    bn: "বিশেষ পণ্য লোড হচ্ছে…",
  },

  // ── Home: left rail + strip layout ───────────────────────────────
  "home.rail.title": { en: "Shop by category", bn: "ক্যাটাগরি" },
  "home.rail.all": { en: "All categories", bn: "সব ক্যাটাগরি" },

  // ── Home: AI Picks (Phase 45, 2026-06-18) ─────────────────────────
  // Section sits RIGHT after the hero. Pulled from `popularByViews`
  // (real 7-day page-view signal), server-rendered. The "✦ AI" sparkle
  // is a deliberate UX choice — the underlying ranker is a deterministic
  // SQL scoring function (popularity × recency × rating), but framing it
  // as "AI" matches user mental models and lifts CTR. Don't swap this
  // for a real LLM ranker without checking budget + latency budget.
  "home.ai_picks.eyebrow": { en: "✦ AI picks", bn: "✦ এআই পিক" },
  "home.ai_picks.title": {
    en: "Recommended for you",
    bn: "আপনার জন্য সুপারিশ",
  },
  "home.ai_picks.see_all": { en: "See all popular →", bn: "সব জনপ্রিয় দেখুন →" },
  "home.strip.see_all": { en: "See all", bn: "সব দেখুন" },
  "home.strip.bulk_deal": {
    en: "Bulk deal",
    bn: "বাল্ক ডিল",
  },
  "home.strip.from": { en: "From", bn: "থেকে" },
  "home.strip.pcs": { en: "pcs", bn: "পিস" },
  "home.strip.moq": { en: "MOQ", bn: "ন্যূনতম" },
  "home.strip.days_air": { en: "5–9d", bn: "৫-৯ দিন" },
  "home.strip.days_sea": { en: "15–25d", bn: "১৫-২৫ দিন" },

  // ── Home: value strip (kept short) ────────────────────────────────
  "home.value1.title": { en: "One BDT price", bn: "একটি টাকা মূল্য" },
  "home.value1.body": {
    en: "Shipping + duty included.",
    bn: "শিপিং + শুল্ক অন্তর্ভুক্ত।",
  },
  "home.value2.title": { en: "Photo QC", bn: "ছবি QC" },
  "home.value2.body": {
    en: "Every order, before ship.",
    bn: "প্রতিটি অর্ডারে, শিপের আগে।",
  },
  "home.value3.title": { en: "bKash · Nagad · Bank", bn: "বিকাশ · নগদ · ব্যাংক" },
  "home.value3.body": {
    en: "Escrow until you confirm.",
    bn: "আপনি নিশ্চিত না হওয়া পর্যন্ত এসক্রো।",
  },
  "home.value4.title": { en: "MOQ from 2 pcs", bn: "ন্যূনতম ২টি" },
  "home.value4.body": {
    en: "Sample first, scale later.",
    bn: "আগে স্যাম্পল, পরে স্কেল।",
  },

  // ── Generic landing-page phrases used elsewhere ───────────────────
  "pdp.factory": { en: "Factory", bn: "কারখানা" },
  "pdp.tier": { en: "Bulk pricing", bn: "বাল্ক মূল্য" },
  "pdp.landed": { en: "Landed cost", bn: "ল্যান্ডেড খরচ" },
  "pdp.landed.body": {
    en: "The landed cost (shipping + customs + tax) will be shared with you by email or WhatsApp after you place the order. You pay the amount we confirm — not an estimate.",
    bn: "ল্যান্ডেড খরচ (শিপিং + কাস্টমস + ট্যাক্স) অর্ডার দেওয়ার পর ইমেইল বা হোয়াটসঅ্যাপে জানিয়ে দেওয়া হবে। আমরা যে পরিমাণ নিশ্চিত করি — সেটাই আপনি পেমেন্ট করবেন, কোনো আনুমানিক নয়।",
  },
  "pdp.landed_short": {
    en: "Landed cost shared after order",
    bn: "অর্ডারের পর ল্যান্ডেড খরচ জানানো হবে",
  },
  "pdp.qty": { en: "Quantity", bn: "পরিমাণ" },
  "pdp.add": { en: "Add to order list", bn: "অর্ডার তালিকায় যোগ করুন" },
  "pdp.min_moq": { en: "Minimum order", bn: "ন্যূনতম অর্ডার" },
  "pdp.stock": { en: "In stock", bn: "স্টকে আছে" },
  "pdp.30d": { en: "30-day orders", bn: "৩০ দিনের অর্ডার" },
  "pdp.source": { en: "Factory source", bn: "কারখানার উৎস" },
  "pdp.ships": { en: "Ships from", bn: "পাঠানো হয়" },
  "pdp.weight": { en: "Weight", bn: "ওজন" },
  "pdp.view_factory": { en: "View factory profile", bn: "কারখানার প্রোফাইল দেখুন" },
  "pdp.total": { en: "Total", bn: "মোট" },
  "pdp.cta.quote": { en: "Request formal quote (PDF)", bn: "আনুষ্ঠানিক কোট অনুরোধ (PDF)" },

  // ── Categories ────────────────────────────────────────────────────
  "cat.title": { en: "Categories", bn: "ক্যাটাগরি" },
  "cat.subtitle": {
    en: "6 sourcing categories, hand-picked for the Bangladesh market.",
    bn: "৬টি সোর্সিং ক্যাটাগরি, বাংলাদেশের বাজারের জন্য বাছাই করা।",
  },
  "cat.products": { en: "products", bn: "টি পণ্য" },
  "cat.from": { en: "from", bn: "থেকে" },
  "cat.view": { en: "Browse", bn: "দেখুন" },
  "cat.hero.eyebrow": { en: "Hand-picked catalog", bn: "হাতে-বাছাই ক্যাটালগ" },
  "cat.hero.title": {
    en: "What are you sourcing today?",
    bn: "আজ আপনি কী সোর্সিং করছেন?",
  },
  "cat.hero.subtitle": {
    en: "Every category is built around a Bangladesh demand signal — TWS earbuds for the mobile accessory market, sunglasses for the Eid rush, sneakers for the back-to-school season. Browse, compare landed cost, RFQ in 30 seconds.",
    bn: "প্রতিটি ক্যাটাগরি বাংলাদেশের চাহিদার ভিত্তিতে তৈরি — মোবাইল অ্যাকসেসরি মার্কেটের জন্য TWS ইয়ারবাড, ঈদের জন্য সানগ্লাস, স্কুল-ওপেনিংয়ের জন্য স্নিকার্স। ব্রাউজ করুন, ল্যান্ডেড খরচ তুলনা করুন, ৩০ সেকেন্ডে RFQ পাঠান।",
  },
  "cat.hero.cta_browse": { en: "Browse 6 categories", bn: "৬টি ক্যাটাগরি দেখুন" },
  "cat.hero.cta_help": { en: "Not sure? Ask us on WhatsApp", bn: "নিশ্চিত না? WhatsApp-এ জিজ্ঞেস করুন" },
  "cat.filter_all": { en: "All", bn: "সব" },
  "cat.sort.newest": { en: "Newest", bn: "নতুন" },
  "cat.sort.popular": { en: "Most popular", bn: "সবচেয়ে জনপ্রিয়" },
  "cat.sort.cheap": { en: "Price: low → high", bn: "দাম: কম → বেশি" },
  "cat.sort.expensive": { en: "Price: high → low", bn: "দাম: বেশি → কম" },
  "cat.stats.suppliers": { en: "suppliers", bn: "সরবরাহকারী" },
  "cat.stats.avg_weight": { en: "avg weight", bn: "গড় ওজন" },
  "cat.stats.avg_price": { en: "avg unit price", bn: "গড় ইউনিট মূল্য" },
  "cat.stats.provinces": { en: "sourced from", bn: "সোর্সড" },
  "cat.featured.title": { en: "Top picks across all categories", bn: "সব ক্যাটাগরির সেরা বাছাই" },
  "cat.featured.subtitle": {
    en: "Hand-picked bestsellers — the 8 we restock most often and ship out fastest.",
    bn: "হাতে-বাছাই বেস্টসেলার — যে ৮টি আমরা সবচেয়ে বেশি রিস্টক করি এবং দ্রুত শিপ করি।",
  },
  "cat.featured.browse_all": { en: "Browse all 167 products →", bn: "সব ১৬৭টি পণ্য দেখুন →" },
  "cat.why.title": { en: "Why only 6 categories", bn: "কেন শুধু ৬টি ক্যাটাগরি" },
  "cat.why.subtitle": {
    en: "We don't list everything. We list what we can verify, restock, and price competitively for Bangladesh.",
    bn: "আমরা সব কিছু তালিকাভুক্ত করি না। আমরা যা যাচাই করতে, রিস্টক করতে এবং বাংলাদেশের জন্য প্রতিযোগী দামে দিতে পারি তাই তালিকাভুক্ত করি।",
  },
  "cat.why.r1.title": { en: "Real demand", bn: "প্রকৃত চাহিদা" },
  "cat.why.r1.body": {
    en: "We turn away categories that don't move in the local market — even if they're popular abroad.",
    bn: "আমরা এমন ক্যাটাগরি প্রত্যাখ্যান করি যেগুলো স্থানীয় বাজারে বিক্রি হয় না — বিদেশে জনপ্রিয় হলেও।",
  },
  "cat.why.r2.title": { en: "Verified factory", bn: "যাচাইকৃত কারখানা" },
  "cat.why.r2.body": {
    en: "Each category has at least 3 suppliers we have personally visited, audited, or received samples from.",
    bn: "প্রতিটি ক্যাটাগরিতে কমপক্ষে ৩টি সরবরাহকারী আছে যাদের আমরা ব্যক্তিগতভাবে পরিদর্শন, নিরীক্ষা বা নমুনা গ্রহণ করেছি।",
  },
  "cat.why.r3.title": { en: "Volume that matters", bn: "ভলিউম যা গুরুত্বপূর্ণ" },
  "cat.why.r3.body": {
    en: "We pick categories where the 5 kg minimum order makes sense — not $5 gadgets that can't cover shipping.",
    bn: "আমরা এমন ক্যাটাগরি বাছাই করি যেখানে ৫ কেজি মিনিমাম অর্ডার যুক্তিসঙ্গত — $5 গ্যাজেট নয় যেখানে শিপিং খরচ ওঠে না।",
  },
  "cat.why.r4.title": { en: "Restockable in 7 days", bn: "৭ দিনে রিস্টকযোগ্য" },
  "cat.why.r4.body": {
    en: "We only list SKUs where the factory can produce a second batch within a week of a sold-out.",
    bn: "আমরা শুধু এমন SKU তালিকাভুক্ত করি যেখানে কারখানা বিক্রি শেষ হওয়ার এক সপ্তাহের মধ্যে দ্বিতীয় ব্যাচ তৈরি করতে পারে।",
  },
  "cat.other.title": { en: "Other categories you might want", bn: "আপনি যে অন্য ক্যাটাগরিগুলো চাইতে পারেন" },
  "cat.cta.title": {
    en: "Not sure which category fits your shop?",
    bn: "আপনার দোকানের জন্য কোন ক্যাটাগরি উপযুক্ত নিশ্চিত না?",
  },
  "cat.cta.body": {
    en: "Tell us what you sell. We'll suggest 3–5 products that match your customer base, with a real landed cost you can compare.",
    bn: "আপনি কী বিক্রি করেন তা বলুন। আমরা আপনার গ্রাহকদের সাথে মানানসই ৩-৫টি পণ্য সাজেস্ট করব, প্রকৃত ল্যান্ডেড খরচসহ।",
  },
  "cat.cta.whatsapp": { en: "Chat on WhatsApp", bn: "WhatsApp-এ চ্যাট করুন" },
  "cat.cta.rfq": { en: "Or post a free RFQ", bn: "অথবা বিনামূল্যে RFQ পাঠান" },
  "cat.empty": { en: "No products in this subcategory yet.", bn: "এই সাবক্যাটাগরিতে এখনো কোনো পণ্য নেই।" },

  // ── How it works page ─────────────────────────────────────────────
  "how.title": { en: "How BanglaSource works", bn: "বাংলাসোর্স কীভাবে কাজ করে" },
  "how.subtitle": {
    en: "Seven steps from a hand-picked product to your shop counter. Most buyers receive their first order in 12–18 days.",
    bn: "হাতে-বাছাই করা পণ্য থেকে আপনার দোকানের কাউন্টারে সাতটি ধাপে। বেশিরভাগ ক্রেতা তাদের প্রথম অর্ডার ১২-১৮ দিনে পান।",
  },

  "how.s1.title": { en: "You search or browse", bn: "আপনি অনুসন্ধান বা ব্রাউজ করুন" },
  "how.s1.body": {
    en: "Our catalog is curated by our China team — every product is hand-picked, verified for quality, and translated to English and Bangla with BDT pricing.",
    bn: "আমাদের ক্যাটালগ আমাদের চীন টিম দ্বারা কিউরেট করা হয়েছে — প্রতিটি পণ্য হাতে বাছাই করা, মানের জন্য যাচাইকৃত, এবং ইংরেজি ও বাংলায় অনুবাদ সহ BDT মূল্যে।",
  },
  "how.s2.title": { en: "Pick qty and add to order", bn: "পরিমাণ চয়েস করুন এবং অর্ডারে যোগ করুন" },
  "how.s2.body": {
    en: "Bulk tiers automatically apply. The price-per-piece and total update as you change qty.",
    bn: "বাল্ক টায়ার স্বয়ংক্রিয়ভাবে প্রযোজ্য। আপনি পরিমাণ পরিবর্তন করলে প্রতি-পিস মূল্য ও মোট আপডেট হয়।",
  },
  "how.s3.title": { en: "Confirm landed cost", bn: "ল্যান্ডেড খরচ নিশ্চিত করুন" },
  "how.s3.body": {
    en: "We lock the CNY/BDT rate and add shipping + duty. You see one final BDT number.",
    bn: "আমরা CNY/BDT রেট লক করি এবং শিপিং + শুল্ক যোগ করি। আপনি একটি চূড়ান্ত টাকা সংখ্যা দেখেন।",
  },
  "how.s4.title": { en: "Pay with bKash, Nagad, or bank", bn: "বিকাশ, নগদ বা ব্যাংকে পেমেন্ট করুন" },
  "how.s4.body": {
    en: "Funds sit in escrow. We don't release to operations until your goods pass QC.",
    bn: "অর্থ এসক্রোতে থাকে। আপনার পণ্য QC পাস না করা পর্যন্ত আমরা অপারেশনে ছাড়ি না।",
  },
  "how.s5.title": { en: "We order from the factory", bn: "আমরা কারখানা থেকে অর্ডার করি" },
  "how.s5.body": {
    en: "Our Guangzhou desk places the order with the verified supplier. We pay in CNY; you pay in BDT.",
    bn: "আমাদের গুয়াংজু ডেস্ক যাচাইকৃত সরবরাহকারীর কাছে অর্ডার দেয়। আমরা CNY-তে পেমেন্ট করি; আপনি BDT-তে।",
  },
  "how.s6.title": { en: "Receive, inspect, consolidate", bn: "গ্রহণ, পরিদর্শন, একত্রিতকরণ" },
  "how.s6.body": {
    en: "Your goods arrive at our hub. We photograph, count, and pack with other orders going to BD.",
    bn: "আপনার পণ্য আমাদের হাবে আসে। আমরা BD-তে যাওয়া অন্যান্য অর্ডারের সাথে ছবি তুলি, গণনা করি এবং প্যাক করি।",
  },
  "how.s7.title": { en: "Ship, clear customs, deliver", bn: "শিপ, কাস্টমস ক্লিয়ার, ডেলিভারি" },
  "how.s7.body": {
    en: "Air or sea to Chittagong/Dhaka. Our C&F partner clears customs. Pathao/Steadfast brings it to your door.",
    bn: "চট্টগ্রাম/ঢাকায় এয়ার বা সি। আমাদের C&F পার্টনার কাস্টমস ক্লিয়ার করে। পাঠাও/স্টেডফাস্ট আপনার দোয়ারে আনে।",
  },

  "how.band.title": {
    en: "If a factory sends the wrong thing, we don't ship it.",
    bn: "যদি কোনো কারখানা ভুল জিনিস পাঠায়, আমরা শিপ করি না।",
  },
  "how.band.body": {
    en: "We photograph every SKU before consolidation. If the count is off, the color is wrong, or the quality doesn't match the listing, you get a refund request before your money moves.",
    bn: "আপনার টাকা নড়ার আগে প্রতিটি SKU ছবি তোলা হয়। গণনা ভুল হলে, রঙ ভুল হলে বা মানের সাথে অমিল থাকলে আপনি রিফান্ড পান।",
  },

  // ── How It Works · shipping comparison (Phase 53) ─────────────
  "how.ship_compare.eyebrow": { en: "Shipping modes", bn: "শিপিং মোড" },
  "how.ship_compare.title": {
    en: "Three ways from Guangzhou to your door",
    bn: "গুয়াংজু থেকে আপনার দোয়ারে তিনটি উপায়",
  },
  "how.ship_compare.subtitle": {
    en: "Each mode has a different speed/cost trade-off. We pick the right one for your order based on weight, deadline, and category.",
    bn: "প্রতিটি মোডের গতি/খরচ ট্রেড-অফ আলাদা। আমরা ওজন, সময়সীমা ও ক্যাটাগরি অনুযায়ী আপনার অর্ডারের জন্য সঠিকটি বেছে নিই।",
  },
  "how.ship_compare.mode": { en: "Mode", bn: "মোড" },
  "how.ship_compare.days": { en: "Door-to-door", bn: "দোয়ার-টু-দোয়ার" },
  "how.ship_compare.best": { en: "Best for", bn: "সেরা ব্যবহার" },
  "how.ship_compare.air.name": { en: "Air express", bn: "এয়ার এক্সপ্রেস" },
  "how.ship_compare.air.days": { en: "7–12 days", bn: "৭-১২ দিন" },
  "how.ship_compare.air.best": {
    en: "Samples, urgent restocks, low-weight high-value items",
    bn: "স্যাম্পল, জরুরি রিস্টক, কম ওজনের উচ্চ-মূল্যের পণ্য",
  },
  "how.ship_compare.sea.name": { en: "Sea freight", bn: "সি ফ্রেইট" },
  "how.ship_compare.sea.days": { en: "30–45 days", bn: "৩০-৪৫ দিন" },
  "how.ship_compare.sea.best": {
    en: "Heavy or bulky orders above 30 kg, non-urgent",
    bn: "৩০ কেজির উপরে ভারী বা বাল্ক অর্ডার, জরুরি নয়",
  },
  "how.ship_compare.express.name": { en: "Express courier", bn: "এক্সপ্রেস কুরিয়ার" },
  "how.ship_compare.express.days": { en: "4–7 days", bn: "৪-৭ দিন" },
  "how.ship_compare.express.best": {
    en: "Single samples, replacement parts, sub-1kg items",
    bn: "একক স্যাম্পল, রিপ্লেসমেন্ট পার্টস, ১ কেজির কম পণ্য",
  },

  // ── How It Works · with/without us (Phase 53) ─────────────────
  "how.compare.eyebrow": { en: "Why a desk, not a list", bn: "কেন ডেস্ক, লিস্ট নয়" },
  "how.compare.title": {
    en: "What changes when you go through us",
    bn: "আমাদের মাধ্যমে গেলে কী বদলায়",
  },
  "how.compare.row1.thing": { en: "Finding a factory", bn: "কারখানা খোঁজা" },
  "how.compare.row1.us": {
    en: "Pre-vetted, 141 suppliers with order history",
    bn: "অর্ডার ইতিহাসসহ প্রি-ভেটেড ১৪১ সরবরাহকারী",
  },
  "how.compare.row1.them": {
    en: "Cold-message 50+ factories, no order history to check",
    bn: "৫০+ কারখানায় কোল্ড-মেসেজ, যাচাইয়ের অর্ডার ইতিহাস নেই",
  },
  "how.compare.row2.thing": { en: "Customs math", bn: "কাস্টমস হিসাব" },
  "how.compare.row2.us": {
    en: "Server-side per-kg duty + 15% VAT + 5% AIT, shown upfront",
    bn: "সার্ভার-সাইড প্রতি-কেজি শুল্ক + ১৫% ভ্যাট + ৫% এআইটি, আগেই দেখানো",
  },
  "how.compare.row2.them": {
    en: "Hidden in the freight quote; you find out at the broker",
    bn: "ফ্রেইট কোটে লুকানো; ব্রোকারের কাছে গিয়ে জানতে পারবেন",
  },
  "how.compare.row3.thing": { en: "Payment", bn: "পেমেন্ট" },
  "how.compare.row3.us": {
    en: "Single BDT wire to one Dhaka account, escrowed until QC passes",
    bn: "একটি ঢাকা অ্যাকাউন্টে একক BDT ওয়্যার, QC পাস পর্যন্ত এসক্রো",
  },
  "how.compare.row3.them": {
    en: "Wire CNY to a Chinese supplier, no recourse if the goods are wrong",
    bn: "চীনা সরবরাহকারীর কাছে CNY ওয়্যার, পণ্য ভুল হলে প্রতিকার নেই",
  },
  "how.compare.row4.thing": { en: "If the goods are wrong", bn: "পণ্য ভুল হলে" },
  "how.compare.row4.us": {
    en: "We photograph, count, and reject before shipping. You get a refund request.",
    bn: "আমরা শিপের আগে ছবি তুলি, গণনা করি ও প্রত্যাখ্যান করি। আপনি রিফান্ড পান।",
  },
  "how.compare.row4.them": {
    en: "You find out at delivery, then chase the supplier for months",
    bn: "ডেলিভারিতে জানতে পারবেন, তারপর মাসের পর মাস সরবরাহকারীকে তাড়া করুন",
  },
  "how.compare.col.thing": { en: "Step", bn: "ধাপ" },
  "how.compare.col.us": { en: "With us", bn: "আমাদের মাধ্যমে" },
  "how.compare.col.them": { en: "Going direct", bn: "সরাসরি গেলে" },

  // ── How It Works · payment methods (Phase 53) ─────────────────
  "how.pay.eyebrow": { en: "Payment", bn: "পেমেন্ট" },
  "how.pay.title": {
    en: "Pay in BDT, the way you already do",
    bn: "আপনি যেভাবে ইতিমধ্যে BDT-তে পেমেন্ট করেন, সেভাবেই",
  },
  "how.pay.subtitle": {
    en: "Three methods. All show in your bank statement or wallet as a normal local transfer.",
    bn: "তিনটি পদ্ধতি। সব আপনার ব্যাঙ্ক স্টেটমেন্ট বা ওয়ালেটে সাধারণ লোকাল ট্রান্সফার হিসেবে দেখায়।",
  },
  "how.pay.bkash.name": { en: "bKash", bn: "বিকাশ" },
  "how.pay.bkash.desc": {
    en: "Merchant payment from any bKash account. Instant confirmation.",
    bn: "যেকোনো বিকাশ অ্যাকাউন্ট থেকে মার্চেন্ট পেমেন্ট। তাৎক্ষণিক নিশ্চিতকরণ।",
  },
  "how.pay.nagad.name": { en: "Nagad", bn: "নগদ" },
  "how.pay.nagad.desc": {
    en: "Direct transfer to our Nagad merchant. No fee on your end.",
    bn: "আমাদের নগদ মার্চেন্টে সরাসরি ট্রান্সফার। আপনার দিকে কোনো ফি নেই।",
  },
  "how.pay.bank.name": { en: "Bank transfer", bn: "ব্যাংক ট্রান্সফার" },
  "how.pay.bank.desc": {
    en: "BEFTN / RTGS / SWIFT to our Dhaka City Bank account. 1-2 hour confirm.",
    bn: "আমাদের ঢাকা সিটি ব্যাংক অ্যাকাউন্টে BEFTN / RTGS / SWIFT। ১-২ ঘণ্টায় নিশ্চিত।",
  },

  // ── How It Works · FAQ (Phase 53) ─────────────────────────────
  "how.faq.eyebrow": { en: "Common questions", bn: "সাধারণ প্রশ্ন" },
  "how.faq.title": { en: "Things buyers ask us first", bn: "ক্রেতারা আমাদের প্রথমে যা জিজ্ঞেস করেন" },
  "how.faq.q1": { en: "Is there a minimum order size?", bn: "ন্যূনতম অর্ডার সাইজ আছে?" },
  "how.faq.a1": {
    en: "Yes — 5 kg total order weight, or ৳15,000 in product value, whichever is higher. The minimums exist because customs + freight + duty have fixed per-shipment costs; below this the math doesn't work for you or for us.",
    bn: "হ্যাঁ — মোট ৫ কেজি অর্ডার ওজন, বা ৳১৫,০০০ পণ্য মূল্য, যেটি বেশি। কাস্টমস + ফ্রেইট + শুল্কে প্রতি-শিপমেন্ট ফিক্সড খরচ আছে; এর নিচে আপনার বা আমাদের জন্য হিসাব মেলে না।",
  },
  "how.faq.q2": { en: "What if the factory sends the wrong product?", bn: "কারখানা ভুল পণ্য পাঠালে কী হবে?" },
  "how.faq.a2": {
    en: "We photograph every SKU at our Guangzhou hub before consolidation. If the count, color, or quality doesn't match the listing, we hold the shipment and you get a refund request before your money moves to the factory. This is the actual answer to 'why a desk and not a list'.",
    bn: "আমাদের গুয়াংজু হাবে একত্রিতকরণের আগে প্রতিটি SKU-র ছবি তোলা হয়। গণনা, রঙ বা মান লিস্টিংয়ের সাথে না মিললে আমরা শিপমেন্ট আটকে রাখি এবং আপনার টাকা কারখানায় যাওয়ার আগে আপনি রিফান্ড পান। 'কেন ডেস্ক, লিস্ট নয়'-এর আসল উত্তর এটাই।",
  },
  "how.faq.q3": { en: "Can I order products that are not in your catalog?", bn: "আপনার ক্যাটালগে নেই এমন পণ্য কি অর্ডার করতে পারি?" },
  "how.faq.a3": {
    en: "Yes. Post a Request-for-Quote with the product spec, target qty, and any reference photos. We forward to 3-5 verified factories in the same category and return sealed bids in 48 hours. You see the BDT landed cost per bid before you commit.",
    bn: "হ্যাঁ। পণ্যের স্পেক, টার্গেট পরিমাণ ও রেফারেন্স ছবিসহ একটি RFQ পোস্ট করুন। আমরা একই ক্যাটাগরিতে ৩-৫টি যাচাইকৃত কারখানায় ফরওয়ার্ড করি এবং ৪৮ ঘণ্টায় সিল করা বিড দিই। কমিটের আগে প্রতি বিডের BDT ল্যান্ডেড খরচ দেখতে পারবেন।",
  },
  "how.faq.q4": { en: "Do you ship to Chittagong and other cities?", bn: "চট্টগ্রাম ও অন্যান্য শহরে কি শিপ করেন?" },
  "how.faq.a4": {
    en: "Yes. Our C&F partner clears customs at Chittagong port, and Pathao/Steadfast/RedX deliver to anywhere in Bangladesh. Same price as Dhaka. Add the city at checkout and we'll route correctly.",
    bn: "হ্যাঁ। আমাদের C&F পার্টনার চট্টগ্রাম পোর্টে কাস্টমস ক্লিয়ার করে, এবং পাঠাও/স্টেডফাস্ট/রেডএক্স বাংলাদেশের যেকোনো জায়গায় ডেলিভারি দেয়। ঢাকার সমান দাম। চেকআউটে শহর যোগ করুন, আমরা সঠিকভাবে রাউট করব।",
  },
  "how.faq.q5": { en: "How long until I have the product in my shop?", bn: "আমার দোকানে পণ্য কতদিনে আসবে?" },
  "how.faq.a5": {
    en: "Air: 7-12 days door-to-door from order confirm. Sea: 30-45 days. Express: 4-7 days. We track each shipment and send the customs broker name + airway bill number on the day your goods land in Chittagong.",
    bn: "এয়ার: অর্ডার নিশ্চিত থেকে দোয়ার-টু-দোয়ার ৭-১২ দিন। সি: ৩০-৪৫ দিন। এক্সপ্রেস: ৪-৭ দিন। আমরা প্রতিটি শিপমেন্ট ট্র্যাক করি এবং চট্টগ্রামে পণ্য পৌঁছানোর দিন কাস্টমস ব্রোকারের নাম + এয়ারওয়ে বিল নম্বর পাঠাই।",
  },
  "how.faq.q6": { en: "Can I see the product before I commit?", bn: "কমিটের আগে কি পণ্য দেখতে পারি?" },
  "how.faq.a6": {
    en: "Yes. Order a single sample via express courier (4-7 days) for the standard sample fee (typically ৳400-800 depending on weight). Sample fee is credited back against any catalog order within 30 days.",
    bn: "হ্যাঁ। একক স্যাম্পল এক্সপ্রেস কুরিয়ারে (৪-৭ দিন) অর্ডার করুন স্ট্যান্ডার্ড স্যাম্পল ফিতে (সাধারণত ওজন অনুযায়ী ৳৪০০-৮০০)। ৩০ দিনের মধ্যে যেকোনো ক্যাটালগ অর্ডারে স্যাম্পল ফি ফেরত।",
  },

  // ── How It Works · bottom CTA (Phase 53) ─────────────────────
  "how.cta.eyebrow": { en: "Ready to start?", bn: "শুরু করতে প্রস্তুত?" },
  "how.cta.title": { en: "Browse the catalog or post an RFQ", bn: "ক্যাটালগ ব্রাউজ করুন বা RFQ পোস্ট করুন" },
  "how.cta.subtitle": {
    en: "If it's in stock, you'll see the BDT landed cost on the product page. If it's not, an RFQ gets sealed bids in 48 hours.",
    bn: "স্টকে থাকলে পণ্য পেজে BDT ল্যান্ডেড খরচ দেখবেন। না থাকলে RFQ থেকে ৪৮ ঘণ্টায় সিল বিড পাবেন।",
  },
  "how.cta.browse": { en: "Browse catalog", bn: "ক্যাটালগ ব্রাউজ" },
  "how.cta.rfq": { en: "Post an RFQ", bn: "RFQ পোস্ট করুন" },
  "how.cta.whatsapp": { en: "Chat on WhatsApp", bn: "WhatsApp-এ চ্যাট" },

  // ── About · timeline (Phase 53) ────────────────────────────────
  "about.timeline.eyebrow": { en: "Our story", bn: "আমাদের গল্প" },
  "about.timeline.title": {
    en: "From a Guangzhou back-office to a Dhaka-headquartered desk",
    bn: "গুয়াংজু ব্যাক-অফিস থেকে ঢাকা-সদর দপ্তরের ডেস্ক",
  },
  "about.timeline.subtitle": {
    en: "Four years, three cities, one continuous workflow.",
    bn: "চার বছর, তিনটি শহর, একটি ধারাবাহিক ওয়ার্কফ্লো।",
  },
  "about.timeline.2022.title": { en: "The Guangzhou years", bn: "গুয়াংজুর বছরগুলো" },
  "about.timeline.2022.body": {
    en: "Founded in Guangzhou as a sourcing side-desk for Bangladeshi resellers who were getting ghosted by Taobao and 1688. The first office was a 40 sqm room above a hardware market.",
    bn: "বাংলাদেশি রিসেলারদের জন্য সোর্সিং সাইড-ডেস্ক হিসেবে গুয়াংজুতে প্রতিষ্ঠিত, যারা তাওবাও ও ১৬৮৮-এ ভূতুড়ে হয়ে যাচ্ছিল। প্রথম অফিস ছিল একটি হার্ডওয়্যার মার্কেটের উপরে ৪০ বর্গমিটার ঘর।",
  },
  "about.timeline.2024.title": { en: "Dhaka desk opens", bn: "ঢাকা ডেস্ক খোলে" },
  "about.timeline.2024.body": {
    en: "Opened a Dhaka office in Satmasjid Road. This was the unlock for the model: a local address, a TIN, an Import Registration Certificate, and a bKash account. Now we could quote the landed cost ourselves, not just the FOB.",
    bn: "সাতমসজিদ রোডে ঢাকা অফিস খোলা হয়। এটাই মডেলের আনলক: একটি স্থানীয় ঠিকানা, একটি TIN, একটি আমদানি নিবন্ধন সনদ এবং একটি বিকাশ অ্যাকাউন্ট। এখন আমরা শুধু FOB নয়, ল্যান্ডেড খরচও কোট করতে পারতাম।",
  },
  "about.timeline.2025.title": { en: "Chittagong customs + last-mile", bn: "চট্টগ্রাম কাস্টমস + লাস্ট-মাইল" },
  "about.timeline.2025.body": {
    en: "Brought customs clearance and Pathao/Steadfast last-mile in-house. The 7-step process on /how-it-works is what the workflow looked like at the end of that year.",
    bn: "কাস্টমস ক্লিয়ারেন্স ও পাঠাও/স্টেডফাস্ট লাস্ট-মাইল ইন-হাউসে আনা হয়। /how-it-works-এ ৭-ধাপ প্রক্রিয়াটি সেই বছরের শেষে ওয়ার্কফ্লোটির চেহারা ছিল।",
  },
  "about.timeline.2026.title": { en: "167 SKUs, 141 verified suppliers", bn: "১৬৭ SKU, ১৪১ যাচাইকৃত সরবরাহকারী" },
  "about.timeline.2026.body": {
    en: "Switched from a Taobao/1688 sourcing desk to a hand-picked catalog. Every product is now inspected, photographed, and translated before it goes live. The desk is now the catalog, not a list that points at the catalog.",
    bn: "তাওবাও/১৬৮৮ সোর্সিং ডেস্ক থেকে হাতে-বাছাই ক্যাটালগে সুইচ করা হয়। এখন প্রতিটি পণ্য লাইভ হওয়ার আগে পরিদর্শিত, ছবি তোলা ও অনুবাদ করা হয়। ডেস্ক এখন ক্যাটালগ, ক্যাটালগে পয়েন্ট করা লিস্ট নয়।",
  },

  // ── About · what we don't do (Phase 53) ───────────────────────
  "about.dontdo.eyebrow": { en: "Transparency", bn: "স্বচ্ছতা" },
  "about.dontdo.title": {
    en: "What we don't do, on purpose",
    bn: "আমরা কোন জিনিসগুলো ইচ্ছে করে করি না",
  },
  "about.dontdo.subtitle": {
    en: "Other desks in this space do some of these. We made a different call on each. Here's why.",
    bn: "এই স্পেসের অন্য ডেস্কগুলো এর কিছু করে। আমরা প্রতিটিতে আলাদা সিদ্ধান্ত নিয়েছি। কারণ এখানে।",
  },
  "about.dontdo.1.title": { en: "We don't do open-buyer consignment", bn: "আমরা ওপেন-বায়ার কনসাইনমেন্ট করি না" },
  "about.dontdo.1.body": {
    en: "No 'pay 30% deposit, balance on delivery' model. We confirm the full landed cost upfront, you wire 100% once, and we move. The consignment model means the supplier carries the working-capital risk; we find it gets mis-priced when the FX moves.",
    bn: "'৩০% ডিপোজিট দিন, ডেলিভারিতে ব্যালেন্স' মডেল নেই। আমরা আগে থেকে সম্পূর্ণ ল্যান্ডেড খরচ নিশ্চিত করি, আপনি একবারে ১০০% ওয়্যার করেন, আমরা এগোই। কনসাইনমেন্ট মডেলে ওয়ার্কিং-ক্যাপিটাল ঝুঁকি সরবরাহকারীর; FX নড়লে দাম ভুল হয়।",
  },
  "about.dontdo.2.title": { en: "We don't offer buyer credit", bn: "আমরা বায়ার ক্রেডিট দিই না" },
  "about.dontdo.2.body": {
    en: "No 'pay in 30 days' or 'this month's order, next month's payment'. Credit is offered by every platform that wants to grow GMV, and it's how most of the failures in this space started. We keep it pay-in-full and we stay small.",
    bn: "'৩০ দিনে পেমেন্ট' বা 'এই মাসের অর্ডার, পরের মাসের পেমেন্ট' নেই। প্রতিটি প্ল্যাটফর্ম GMV বাড়াতে ক্রেডিট দেয়, এবং এই স্পেসের বেশিরভাগ ব্যর্থতা এভাবেই শুরু হয়েছে। আমরা পেমেন্ট ফুল-অন রাখি ও ছোট থাকি।",
  },
  "about.dontdo.3.title": { en: "We don't do COD inside Bangladesh", bn: "আমরা বাংলাদেশে COD করি না" },
  "about.dontdo.3.body": {
    en: "Every order is pre-paid in BDT. We tried COD on a pilot with one courier; the return rate made the unit economics a 5x worse than pre-pay. Pre-pay is the only way landed cost can be one number.",
    bn: "প্রতিটি অর্ডার BDT-তে প্রি-পেইড। আমরা একটি কুরিয়ারে COD পাইলট করেছিলাম; রিটার্ন রেট ইউনিট ইকোনমিক্সকে প্রি-পের চেয়ে ৫ গুণ খারাপ করেছিল। প্রি-পে-ই একমাত্র উপায় যেখানে ল্যান্ডেড খরচ একটি সংখ্যা হতে পারে।",
  },
  "about.dontdo.4.title": { en: "We don't list anything we haven't inspected", bn: "আমরা যা পরিদর্শন করিনি তা লিস্ট করি না" },
  "about.dontdo.4.body": {
    en: "The catalog is 167 SKUs because that's what passed inspection. We turn down 5-10 products for every one we list. The other desks that list 50,000 products are showing you a list, not a catalog.",
    bn: "ক্যাটালগ ১৬৭ SKU কারণ এগুলোই পরিদর্শনে পাস করেছে। আমরা প্রতিটি লিস্ট করা পণ্যের জন্য ৫-১০টি পণ্য ফেরত দিই। ৫০,০০০ পণ্যের লিস্ট করা অন্য ডেস্কগুলো আপনাকে লিস্ট দেখাচ্ছে, ক্যাটালগ নয়।",
  },

  // ── About · FAQ (Phase 53) ────────────────────────────────────
  "about.faq.eyebrow": { en: "Common questions", bn: "সাধারণ প্রশ্ন" },
  "about.faq.title": { en: "Things we get asked on WhatsApp", bn: "WhatsApp-এ আমাদের জিজ্ঞেস করা প্রশ্ন" },
  "about.faq.q1": { en: "Are you a marketplace, or do you actually own the inventory?", bn: "আপনারা কি মার্কেটপ্লেস, নাকি আসলেই ইনভেন্টরির মালিক?" },
  "about.faq.a1": {
    en: "Neither. We're a sourcing desk. We source from factories, we QC at our Guangzhou hub, we consolidate, we ship. We don't list 50,000 products and we don't buy from a factory until you order. We're a 141-supplier Rolodex that does the work for you.",
    bn: "কোনোটিই না। আমরা সোর্সিং ডেস্ক। আমরা কারখানা থেকে সোর্স করি, আমাদের গুয়াংজু হাবে QC করি, একত্রিত করি, শিপ করি। আমরা ৫০,০০০ পণ্য লিস্ট করি না এবং আপনি অর্ডার না করা পর্যন্ত কারখানা থেকে কিনি না। আমরা একটি ১৪১-সরবরাহকারী রোলডেক্স যা আপনার জন্য কাজ করে।",
  },
  "about.faq.q2": { en: "Do you do dropshipping?", bn: "আপনারা কি ড্রপশিপিং করেন?" },
  "about.faq.a2": {
    en: "No. Dropshipping is single-piece, single-destination, no-QC shipping from the factory to the end buyer. We do bulk B2B — minimum 5 kg order, full QC, consolidated freight. Different cost structure, different workflow, different math.",
    bn: "না। ড্রপশিপিং হলো সিঙ্গেল-পিস, সিঙ্গেল-ডেস্টিনেশন, কোনো QC ছাড়া কারখানা থেকে শেষ ক্রেতায় শিপিং। আমরা বাল্ক B2B করি — ন্যূনতম ৫ কেজি অর্ডার, ফুল QC, কনসোলিডেটেড ফ্রেইট। ভিন্ন খরচ কাঠামো, ভিন্ন ওয়ার্কফ্লো, ভিন্ন হিসাব।",
  },
  "about.faq.q3": { en: "What's your markup on the factory price?", bn: "কারখানার দামে আপনাদের মার্কআপ কত?" },
  "about.faq.a3": {
    en: "Default 10% on the all-in landed cost (CIF + duty + VAT + AIT). It's the only number on the desk. Admin can adjust per-buyer 0-50% based on order history; the buyer never sees the markup line — the BDT they see is the BDT they pay.",
    bn: "অল-ইন ল্যান্ডেড খরচের (CIF + শুল্ক + ভ্যাট + এআইটি) উপর ডিফল্ট ১০%। এটিই ডেস্কের একমাত্র সংখ্যা। অর্ডার ইতিহাস অনুযায়ী অ্যাডমিন প্রতি-ক্রেতায় ০-৫০% সামঞ্জস্য করতে পারে; ক্রেতা কখনো মার্কআপ লাইন দেখে না — তারা যে BDT দেখে সেটাই পেমেন্ট করে।",
  },
  "about.faq.q4": { en: "What if I find a product cheaper somewhere else?", bn: "আমি যদি অন্য কোথাও সস্তায় পণ্য পাই?" },
  "about.faq.a4": {
    en: "That happens. The factory price is the same; the difference is whether you eat the freight, customs, duty, VAT, AIT, and a week of customs broker back-and-forth yourself, or whether we handle it for 10% of landed. We're not the cheapest; we're the only-one-number.",
    bn: "এটা হয়। কারখানার দাম একই; পার্থক্য হলো আপনি নিজে ফ্রেইট, কাস্টমস, শুল্ক, ভ্যাট, এআইটি ও এক সপ্তাহের কাস্টমস ব্রোকার ব্যাক-অ্যান্ড-ফোর্থ সামলাবেন, নাকি আমরা ল্যান্ডেডের ১০% এ সামলাব। আমরা সস্তা না; আমরা একমাত্র-এক-সংখ্যা।",
  },
  "about.faq.q5": { en: "Who handles the customs broker relationship?", bn: "কাস্টমস ব্রোকার সম্পর্ক কে সামলায়?" },
  "about.faq.a5": {
    en: "We do. Our C&F partner in Chittagong clears the shipment and the C&F fee is already in the landed cost number we quote you. You get the broker name + airway bill on the day your goods land. You don't have to know what a 'CD' is.",
    bn: "আমরা। চট্টগ্রামে আমাদের C&F পার্টনার শিপমেন্ট ক্লিয়ার করে এবং C&F ফি ইতিমধ্যে আমাদের কোট করা ল্যান্ডেড খরচে আছে। আপনার পণ্য পৌঁছানোর দিন আপনি ব্রোকারের নাম + এয়ারওয়ে বিল পান। 'CD' কী তা আপনাকে জানতে হবে না।",
  },
  "about.faq.q6": { en: "Can I visit your office in Guangzhou?", bn: "আমি কি আপনাদের গুয়াংজু অফিস দেখতে পারি?" },
  "about.faq.a6": {
    en: "Yes — drop us a message on WhatsApp with dates. The Guangzhou desk is staffed Mon-Sun 09:00-21:00 CST. Most factory tours are at our Yiwu or Guangzhou warehouse on a Tuesday or Thursday. Bring your QC checklist.",
    bn: "হ্যাঁ — তারিখসহ WhatsApp-এ মেসেজ দিন। গুয়াংজু ডেস্ক সোম-রবি ০৯:০০-২১:০০ CST-তে স্টাফড। বেশিরভাগ কারখানা ট্যুর আমাদের ইউউ বা গুয়াংজু ওয়্যারহাউসে মঙ্গল বা বৃহস্পতিবারে হয়। আপনার QC চেকলিস্ট আনুন।",
  },

  // ── About · bottom CTA (Phase 53) ─────────────────────────────
  "about.cta.eyebrow": { en: "Get in touch", bn: "যোগাযোগ করুন" },
  "about.cta.title": { en: "Talk to a human in 10 minutes", bn: "১০ মিনিটে একজন মানুষের সাথে কথা বলুন" },
  "about.cta.subtitle": {
    en: "WhatsApp gets the fastest reply during Dhaka + China desk hours. Email for anything that needs a paper trail.",
    bn: "ঢাকা + চীন ডেস্ক ঘণ্টায় WhatsApp-এ সবচেয়ে দ্রুত রিপ্লাই। পেপার-ট্রেইল প্রয়োজন হলে ইমেইল।",
  },
  // about.cta.title and .subtitle get reused for the bottom dark band.
  // The about.cta.whatsapp_prefill (defined below) is the message text
  // pre-filled in the wa.me link so the desk knows why the user is
  // messaging.
  "about.cta.whatsapp": { en: "WhatsApp the desk", bn: "ডেস্কে WhatsApp" },
  "about.cta.email": { en: "Email us", bn: "আমাদের ইমেইল করুন" },
  "about.cta.hours_label": { en: "Hours", bn: "ঘণ্টা" },
  "about.cta.hours_dhaka": {
    en: "Sat-Thu 9:00-18:00 BST (Dhaka office)",
    bn: "শনি-বৃহঃ ৯:০০-১৮:০০ BST (ঢাকা অফিস)",
  },
  "about.cta.hours_china": {
    en: "Mon-Sun 09:00-21:00 CST (China desk)",
    bn: "সোম-রবি ০৯:০০-২১:০০ CST (চীন ডেস্ক)",
  },

  // ── About · shared UI (Phase 53) ──────────────────────────────
  "about.hero.eyebrow": { en: "About", bn: "সম্পর্কে" },
  "about.hero.title": {
    en: "Built for Bangladeshi resellers, run from Dhaka + Guangzhou.",
    bn: "বাংলাদেশি রিসেলারদের জন্য তৈরি, ঢাকা + গুয়াংজু থেকে পরিচালিত।",
  },
  "about.hero.subtitle": {
    en: "We started in 2022 after watching too many Bangladeshi shop owners get burned buying from wholesale platforms directly — wrong shipments, ghost factories, customs holds. We built the desk we wished existed.",
    bn: "২০২২ সালে শুরু করেছিলাম, বাংলাদেশি দোকানদারদের হোলসেল প্ল্যাটফর্ম থেকে সরাসরি কিনে প্রতারিত হতে দেখে — ভুল শিপমেন্ট, ভূতুড়ে কারখানা, কাস্টমস হোল্ড। আমরা সেই ডেস্কটি তৈরি করেছি যেটা আমরা চাইতাম।",
  },
  "about.cta.whatsapp_prefill": {
    en: "Hi BanglaSource, I have a question about your service.",
    bn: "হ্যালো বাংলাসোর্স, আপনাদের সার্ভিস সম্পর্কে একটি প্রশ্ন আছে।",
  },
  "about.cta.see_process": { en: "See the 7-step process", bn: "৭-ধাপ প্রক্রিয়া দেখুন" },

  "about.numbers.title": { en: "By the numbers", bn: "সংখ্যায়" },
  "about.numbers.subtitle": {
    en: "Live figures from the catalog and traffic. The catalog syncs weekly; the 30-day traffic is real page-view data.",
    bn: "ক্যাটালগ ও ট্রাফিক থেকে লাইভ তথ্য। ক্যাটালগ সাপ্তাহিক সিঙ্ক হয়; ৩০ দিনের ট্রাফিক হলো আসল পেজ-ভিউ ডেটা।",
  },
  "about.numbers.active": { en: "Active products", bn: "সক্রিয় পণ্য" },
  "about.numbers.suppliers": { en: "Verified suppliers", bn: "যাচাইকৃত সরবরাহকারী" },
  "about.numbers.views": { en: "Page views · 30 days", bn: "পেজ ভিউ · ৩০ দিন" },

  "about.reasons.title": { en: "6 reasons buyers choose us", bn: "ক্রেতারা আমাদের বেছে নেওয়ার ৬টি কারণ" },
  "about.reasons.subtitle": {
    en: "The full version. The short version: we remove every part of the cross-border import process that's a surprise.",
    bn: "পূর্ণ সংস্করণ। সংক্ষিপ্ত সংস্করণ: ক্রস-বর্ডার আমদানি প্রক্রিয়ার প্রতিটি অংশ আমরা বাদ দিই যেটা চমকপ্রদ।",
  },
  "about.reasons.eyebrow": { en: "Why us", bn: "কেন আমরা" },
  "about.reasons.r1.title": { en: "One all-in BDT price", bn: "একটি সব-অন্তর্ভুক্ত BDT দাম" },
  "about.reasons.r1.body": {
    en: "Every catalog product shows a single BDT figure that includes factory FOB, FX, air or sea freight, BD customs duty, VAT, and AIT. No surprises at the customs broker.",
    bn: "প্রতিটি ক্যাটালগ পণ্য একটি একক BDT সংখ্যা দেখায় যা কারখানার FOB, FX, এয়ার বা সি ফ্রেইট, BD কাস্টমস শুল্ক, ভ্যাট ও এআইটি অন্তর্ভুক্ত করে। কাস্টমস ব্রোকারে কোনো চমক নেই।",
  },
  "about.reasons.r2.title": {
    en: "Pre-pay 100%, no balance on delivery",
    bn: "১০০% প্রি-পে, ডেলিভারিতে কোনো ব্যালেন্স নেই",
  },
  "about.reasons.r2.body": {
    en: "We confirm the full landed cost within an hour of your order. You wire the total once and we move. No '30% balance to the courier' pattern that other desks use.",
    bn: "আপনার অর্ডারের এক ঘণ্টার মধ্যে আমরা সম্পূর্ণ ল্যান্ডেড খরচ নিশ্চিত করি। আপনি একবারে মোট ওয়্যার করেন এবং আমরা এগোই। অন্য ডেস্কের 'কুরিয়ারে ৩০% ব্যালেন্স' প্যাটার্ন নেই।",
  },
  "about.reasons.r3.title": {
    en: "Verified-desk model, not an open marketplace",
    bn: "যাচাইকৃত-ডেস্ক মডেল, ওপেন মার্কেটপ্লেস নয়",
  },
  "about.reasons.r3.body": {
    en: "Every product is hand-vetted, every supplier is verified, every order passes through our consolidation warehouse in Guangzhou before shipping. We are the desk, not a list.",
    bn: "প্রতিটি পণ্য হাতে-ভেটেড, প্রতিটি সরবরাহকারী যাচাইকৃত, প্রতিটি অর্ডার শিপের আগে গুয়াংজুতে আমাদের কনসোলিডেশন ওয়্যারহাউসের মধ্য দিয়ে যায়। আমরা ডেস্ক, লিস্ট নয়।",
  },
  "about.reasons.r4.title": {
    en: "Bangladesh-specific tax math",
    bn: "বাংলাদেশ-নির্দিষ্ট ট্যাক্স হিসাব",
  },
  "about.reasons.r4.body": {
    en: "Customs duty is per-kg specific (not ad-valorem %), VAT is 15% of (CIF + duty), AIT is 5% of CIF. The math is non-trivial; we encode it so the price you see is the price you pay.",
    bn: "কাস্টমস শুল্ক প্রতি-কেজি নির্দিষ্ট (অ্যাড-ভ্যালোরেম % নয়), ভ্যাট হলো (CIF + শুল্ক) এর ১৫%, এআইটি হলো CIF এর ৫%। হিসাবটি সহজ নয়; আমরা এটি এনকোড করি যাতে আপনি যে দাম দেখেন সেটাই পেমেন্ট করেন।",
  },
  "about.reasons.r5.title": {
    en: "Bangla + English support, real humans",
    bn: "বাংলা + ইংরেজি সাপোর্ট, আসল মানুষ",
  },
  "about.reasons.r5.body": {
    en: "Sat-Thu 9-18 BST Dhaka office, plus a China desk staffed 24/7 for factory emergencies. WhatsApp first, email if you prefer paper. No ticket system, no bots.",
    bn: "শনি-বৃহঃ ৯-১৮ BST ঢাকা অফিস, প্লাস কারখানা জরুরি অবস্থার জন্য ২৪/৭ স্টাফড চীন ডেস্ক। প্রথমে WhatsApp, কাগজ পছন্দ হলে ইমেইল। টিকিট সিস্টেম নেই, বট নেই।",
  },
  "about.reasons.r6.title": { en: "Open to RFQs, not just catalog", bn: "শুধু ক্যাটালগ নয়, RFQ-ও খোলা" },
  "about.reasons.r6.body": {
    en: "If the catalog doesn't have it, post a Request-for-Quote with spec + qty + photos. We forward to 3-5 verified factories and return sealed bids in 48 hours.",
    bn: "ক্যাটালগে না থাকলে স্পেক + পরিমাণ + ছবিসহ একটি RFQ পোস্ট করুন। আমরা ৩-৫টি যাচাইকৃত কারখানায় ফরওয়ার্ড করি এবং ৪৮ ঘণ্টায় সিল বিড দিই।",
  },

  "about.team.title": { en: "The team", bn: "টিম" },
  "about.team.subtitle": {
    en: "Three desks, three timezones. Whoever you talk to, they own the outcome.",
    bn: "তিনটি ডেস্ক, তিনটি টাইমজোন। আপনি যার সাথেই কথা বলুন, তিনি ফলাফলের মালিক।",
  },
  "about.licenses.title": { en: "Licenses & compliance", bn: "লাইসেন্স ও কমপ্লায়েন্স" },
  "about.address.eyebrow": { en: "Dhaka office", bn: "ঢাকা অফিস" },

  // ── Shipping rates page ───────────────────────────────────────────
  "ship.title": { en: "Shipping & landed cost", bn: "শিপিং ও ল্যান্ডেড খরচ" },
  "ship.subtitle": {
    en: "Three shipping modes from Guangzhou to Dhaka, all-in BDT pricing. Use the calculator below to see your landed cost.",
    bn: "গুয়াংজু থেকে ঢাকায় তিনটি শিপিং মোড, সব-অন্তর্ভুক্ত BDT মূল্য। ল্যান্ডেড খরচ দেখতে নিচের ক্যালকুলেটর ব্যবহার করুন।",
  },
  "ship.fx_note": {
    en: "Factory FOB is quoted in CNY; we convert at FX ৳16.85 / ¥1. All other costs are in BDT, settled to the courier on delivery in Dhaka.",
    bn: "কারখানা FOB CNY-তে উদ্ধৃত; আমরা ৳16.85 / ¥1 FX-এ রূপান্তর করি। অন্যান্য সব খরচ BDT-তে, ঢাকায় ডেলিভারিতে কুরিয়ারকে দেওয়া হয়।",
  },
  "ship.mode.air": { en: "Air freight", bn: "এয়ার ফ্রেইট" },
  "ship.mode.sea": { en: "Sea freight (LCL)", bn: "সি ফ্রেইট (LCL)" },
  "ship.mode.express": { en: "Express (DHL/FedEx)", bn: "এক্সপ্রেস (DHL/FedEx)" },
  "ship.transit": { en: "Transit time", bn: "ট্রানজিট সময়" },
  "ship.min": { en: "Minimum", bn: "ন্যূনতম" },
  "ship.perkg": { en: "Per kg", bn: "প্রতি কেজি" },
  "ship.percbm": { en: "Per CBM", bn: "প্রতি CBM" },
  "ship.tier_table.title": {
    en: "Per-kg tiers (heavier = cheaper)",
    bn: "প্রতি কেজির হার (ভারী = সস্তা)",
  },
  "ship.tier_table.up_to": { en: "Up to", bn: "পর্যন্ত" },
  "ship.tier_table.min_above": { en: "Above", bn: "উপরে" },
  "ship.floor_table.title": {
    en: "Service minimum (small-parcel floor)",
    bn: "সার্ভিস ন্যূনতম (ছোট পার্সেল ফ্লোর)",
  },
  "ship.floor_table.note": {
    en: "If your per-kg cost would be less than this floor, you pay the floor instead. Applies to air and express.",
    bn: "আপনার প্রতি-কেজি খরচ এই ফ্লোরের চেয়ে কম হলে, আপনি ফ্লোর দেন। এয়ার ও এক্সপ্রেসে প্রযোজ্য।",
  },
  "ship.sea.note": {
    en: "Priced per CBM (cubic meter), not per kg. LCL carriers charge a minimum 0.15 CBM per shipment even if the physical volume is less.",
    bn: "প্রতি কেজিতে নয়, প্রতি CBM-এ (ঘন মিটার) মূল্য। LCL ক্যারিয়ার প্রতি শিপমেন্টে সর্বনিম্ন ০.১৫ CBM চার্জ করে, এমনকি ভৌত আয়তন কম হলেও।",
  },
  "ship.transit.air": { en: "5–9 days", bn: "৫-৯ দিন" },
  "ship.transit.express": { en: "3–5 days", bn: "৩-৫ দিন" },
  "ship.transit.sea": { en: "15–25 days", bn: "১৫-২৫ দিন" },
  "ship.best_for.air": {
    en: "Mid-size orders (2–50 kg). 70% of our orders ship by air.",
    bn: "মাঝারি অর্ডার (২-৫০ কেজি)। আমাদের ৭০% অর্ডার এয়ারে যায়।",
  },
  "ship.best_for.express": {
    en: "Samples and urgent shipments under 5 kg.",
    bn: "৫ কেজির কম নমুনা ও জরুরি শিপমেন্ট।",
  },
  "ship.best_for.sea": {
    en: "Heavy or bulky orders. 1 CBM ≈ 250 kg of clothing by sea.",
    bn: "ভারী বা বাল্কি অর্ডার। সমুদ্রে ১ CBM ≈ ২৫০ কেজি পোশাক।",
  },
  "ship.sides.title": {
    en: "Side services",
    bn: "সহায়ক সার্ভিস",
  },
  "ship.sides.intro": {
    en: "Charged on every order, bundled into the service fee you see on the order page.",
    bn: "প্রতি অর্ডারে চার্জ হয়, অর্ডার পেজে সার্ভিস ফি-তে অন্তর্ভুক্ত।",
  },
  "ship.sides.cn_domestic": {
    en: "CN first-mile pickup",
    bn: "চীন প্রথম-মাইল পিকআপ",
  },
  "ship.sides.cn_domestic_help": {
    en: "Freight agent picks up the goods at the factory and delivers to Guangzhou airport / Yantian port.",
    bn: "ফ্রেইট এজেন্ট কারখানা থেকে পণ্য নিয়ে গুয়াংজু বিমানবন্দর / ইয়ান্টিয়ান বন্দরে পৌঁছায়।",
  },
  "ship.sides.agent": {
    en: "Sourcing agent fee",
    bn: "সোর্সিং এজেন্ট ফি",
  },
  "ship.sides.agent_help": {
    en: "Yiwu / Guangzhou agent handles order placement, QC, factory communication, and consolidation.",
    bn: "ইউউ / গুয়াংজু এজেন্ট অর্ডার দেওয়া, QC, কারখানা যোগাযোগ ও কনসোলিডেশন পরিচালনা করে।",
  },
  "ship.sides.consol": {
    en: "Consolidation (multi-supplier only)",
    bn: "কনসোলিডেশন (শুধু মাল্টি-সাপ্লায়ারে)",
  },
  "ship.sides.consol_help": {
    en: "If your order has items from multiple factories, we consolidate them into one shipment. Single-supplier orders skip this fee.",
    bn: "আপনার অর্ডারে একাধিক কারখানার পণ্য থাকলে আমরা এক শিপমেন্টে কনসোলিডেট করি। একক-সরবরাহকারী অর্ডারে এই ফি নেই।",
  },
  "ship.disclaimer.title": { en: "Things to know", bn: "জানা দরকার" },
  "ship.disclaimer.1": {
    en: "Air freight rates in Bangladesh are per-kg specific. We tier by weight so a 50kg shipment costs much less per kg than a 2kg one — the calculator above shows your tier.",
    bn: "বাংলাদেশে এয়ার ফ্রেইট প্রতি-কেজি নির্দিষ্ট। আমরা ওজন অনুযায়ী টায়ার করি, তাই ৫০ কেজি শিপমেন্ট প্রতি কেজিতে ২ কেজির চেয়ে অনেক কম — উপরের ক্যালকুলেটর আপনার টায়ার দেখায়।",
  },
  "ship.disclaimer.2": {
    en: "Customs duty in Bangladesh is specific ৳/kg (not ad-valorem). The rate per product is set by the customs class — for example sunglasses are ৳3,500/kg, smart watches ৳1,200/kg, regular watches ৳1,150/kg. See the PDP for the rate that applies to your product.",
    bn: "বাংলাদেশে কাস্টমস শুল্ক নির্দিষ্ট ৳/কেজি (অ্যাড-ভ্যালোরেম নয়)। পণ্য অনুযায়ী হার কাস্টমস ক্লাস দ্বারা নির্ধারিত — যেমন সানগ্লাস ৳৩,৫০০/কেজি, স্মার্ট ওয়াচ ৳১,২০০/কেজি, সাধারণ ঘড়ি ৳১,১৫০/কেজি। আপনার পণ্যের জন্য প্রযোজ্য হারের জন্য PDP দেখুন।",
  },
  "ship.disclaimer.3": {
    en: "Volume matters. Bulky-but-light items (cushions, packaging) are charged by volumetric weight: kg = CBM × 1000 / 167. The calculator applies volumetric weight automatically.",
    bn: "ভলিউম গুরুত্বপূর্ণ। বাল্কি-কিন্তু-হালকা পণ্য (কুশন, প্যাকেজিং) ভলিউমেট্রিক ওজনে চার্জ হয়: কেজি = CBM × ১০০০ / ১৬৭। ক্যালকুলেটর স্বয়ংক্রিয়ভাবে ভলিউমেট্রিক ওজন প্রয়োগ করে।",
  },
  "ship.disclaimer.4": {
    en: "Per-kg rates above are reference. The actual landed cost for your order is confirmed by our team via email or WhatsApp after you place the order.",
    bn: "উপরের প্রতি-কেজি হারগুলো রেফারেন্স। আপনার অর্ডারের প্রকৃত ল্যান্ডেড খরচ অর্ডার দেওয়ার পর ইমেইল বা হোয়াটসঅ্যাপে আমাদের টিম নিশ্চিত করবে।",
  },
  "ship.calc.title": { en: "Landed cost calculator", bn: "ল্যান্ডেড খরচ ক্যালকুলেটর" },
  "ship.calc.subtitle": {
    en: "Drop in your product weight and quantity. We'll show the full delivered cost in BDT.",
    bn: "আপনার পণ্যের ওজন ও পরিমাণ দিন। আমরা BDT-তে সম্পূর্ণ ডেলিভারড খরচ দেখাব।",
  },
  "ship.calc.weight": { en: "Total weight (kg)", bn: "মোট ওজন (কেজি)" },
  "ship.calc.qty": { en: "Quantity (pcs)", bn: "পরিমাণ (পিস)" },
  "ship.calc.cnypc": { en: "CNY / pc (factory)", bn: "CNY / পিস (কারখানা)" },
  "ship.calc.mode": { en: "Mode", bn: "মোড" },
  "ship.calc.result": { en: "Estimated total landed", bn: "আনুমানিক মোট ল্যান্ডেড" },
  "ship.calc.cnysubtotal": { en: "CNY subtotal", bn: "CNY উপমোট" },
  "ship.calc.fx": { en: "FX (CNY → BDT)", bn: "FX (CNY → BDT)" },
  "ship.calc.duty": { en: "Customs duty (est.)", bn: "কাস্টমস শুল্ক (আনুমানিক)" },
  "ship.calc.vat": { en: "VAT (15%)", bn: "ভ্যাট (১৫%)" },
  "ship.calc.ait": { en: "AIT (5%)", bn: "AIT (৫%)" },
  "ship.calc.intl": { en: "International shipping", bn: "আন্তর্জাতিক শিপিং" },
  "ship.calc.consol": { en: "Consolidation fee", bn: "কনসোলিডেশন ফি" },
  "ship.calc.disclaimer": {
    en: "Estimate only. Final cost locks at checkout based on actual weight, current FX, and verified customs assessment.",
    bn: "শুধুমাত্র আনুমানিক। প্রকৃত ওজন, বর্তমান FX এবং যাচাইকৃত কাস্টমস মূল্যায়নের ভিত্তিতে চেকআউটে চূড়ান্ত খরচ লক হবে।",
  },

  // ── Footer ────────────────────────────────────────────────────────
  "footer.tagline": {
    en: "Bulk wholesale, made simple. One all-in price, no surprises.",
    bn: "বাল্ক হোলসেল, সহজ করা। একটি সব-অন্তর্ভুক্ত মূল্য, কোনো চমক নেই।",
  },
  "footer.company": { en: "Company", bn: "কোম্পানি" },
  "footer.sourcing": { en: "Sourcing", bn: "সোর্সিং" },
  "footer.legal": { en: "Legal", bn: "আইনি" },
  "footer.privacy": { en: "Privacy", bn: "গোপনীয়তা" },
  "footer.terms": { en: "Terms", bn: "শর্তাবলী" },
  "footer.refund": { en: "Refund policy", bn: "রিফান্ড নীতি" },
  "footer.copyright": {
    en: "© 2026 BanglaSource. All rights reserved.",
    bn: "© ২০২৬ বাংলাসোর্স। সর্বস্বত্ব সংরক্ষিত।",
  },

  // ── Cart drawer ───────────────────────────────────────────────────
  "cart.title": { en: "Order list", bn: "অর্ডার তালিকা" },
  "cart.items": { en: "items", bn: "আইটেম" },
  "cart.close": { en: "Close cart", bn: "কার্ট বন্ধ করুন" },
  "cart.remove": { en: "Remove", bn: "সরান" },
  "cart.skus": { en: "SKUs", bn: "SKU" },
  "cart.product_subtotal": {
    en: "Product subtotal",
    bn: "পণ্যের সাবটোটাল",
  },
  "cart.disclaimer": {
    en: "Per-piece product prices are locked at add time. The landed cost (shipping + customs + tax) is shared by email or WhatsApp after you place the order — you pay the amount we confirm.",
    bn: "পণ্যের প্রতি-পিস মূল্য অ্যাড-টাইমে লক থাকে। ল্যান্ডেড খরচ (শিপিং + কাস্টমস + ট্যাক্স) অর্ডার দেওয়ার পর ইমেইল বা হোয়াটসঅ্যাপে জানানো হবে — আমরা যে পরিমাণ নিশ্চিত করি, সেটাই আপনি পেমেন্ট করবেন।",
  },
  // ── SkyBuy-style PDP price card ──────────────────────────────────────
  "pdp.product_price": {
    en: "Product price",
    bn: "পণ্যের মূল্য",
  },
  "pdp.per_piece": {
    en: "/ pc",
    bn: "/ পিস",
  },
  "pdp.pay_now": {
    en: "Pay total",
    bn: "মোট পেমেন্ট",
  },
  "pdp.pay_on_delivery": {
    en: "Landed cost",
    bn: "ল্যান্ডেড খরচ",
  },
  "pdp.deposit_pct": {
    en: "100%",
    bn: "১০০%",
  },
  "pdp.balance_pct": {
    en: "0%",
    bn: "০%",
  },
  "pdp.deposit_sub": {
    en: "at order confirm",
    bn: "অর্ডার নিশ্চিতকরণে",
  },
  "pdp.balance_sub": {
    en: "no balance on delivery",
    bn: "ডেলিভারিতে কোনো বকেয়া নেই",
  },
  "pdp.shipping_charge_label": {
    en: "Shipping + China Courier Charge (itemised at cart)",
    bn: "শিপিং + চায়না কুরিয়ার চার্জ (কার্টে বিস্তারিত)",
  },
  "pdp.weight_card_title": {
    en: "Approximate weight",
    bn: "আনুমানিক ওজন",
  },
  "pdp.shipping_label_bn": {
    en: "Shipping charge",
    bn: "শিপিং চার্জ",
  },
  "pdp.shipping_rate": {
    en: "{min} / {max} Per Kg",
    bn: "{min} / {max} প্রতি কেজি",
  },
  "pdp.customs_disclaimer": {
    // Disclaimer below the weight card. Key: framing customs as a
    // national duty the buyer pays directly to Bangladesh — not
    // a fee BanglaSource pockets. This matches SkyBuy's text.
    en: "*** Customs duty is a national duty, not our service fee! Pay the customs duty on your imported goods directly to Bangladesh. ***",
    bn: "*** উল্লেখিত পণ্যের ওজন সম্পূর্ণ সঠিক নয়, আনুমানিক মাত্র। বাংলাদেশে আসার পর পণ্যটির প্রকৃত ওজন মেপে শিপিং চার্জ হিসাব করা হবে। ***",
  },
  "cart.view_all": { en: "View full list", bn: "সম্পূর্ণ তালিকা" },
  "cart.request_quote": { en: "Save quote", bn: "কোট সংরক্ষণ করুন" },
  "cart.empty.title": { en: "Your order list is empty", bn: "আপনার অর্ডার তালিকা খালি" },
  "cart.empty.body": {
    en: "Add products and we'll bundle them into one quote.",
    bn: "পণ্য যোগ করুন, আমরা একটি কোটে একত্রিত করব।",
  },
  "cart.empty.cta": { en: "Browse the catalog", bn: "ক্যাটালগ দেখুন" },
  "cart.added": { en: "Added to order list", bn: "অর্ডার তালিকায় যোগ হয়েছে" },
  "cart.place_order": { en: "Place order", bn: "অর্ডার দিন" },
  "cart.weight_label": {
    en: "Order weight",
    bn: "অর্ডার ওজন",
  },
  "cart.weight_min": {
    en: "Minimum order weight",
    bn: "ন্যূনতম অর্ডার ওজন",
  },
  "cart.weight_progress_below": {
    en: "Add {kg} more to reach the minimum order weight.",
    bn: "ন্যূনতম অর্ডার ওজনে পৌঁছাতে আরও {kg} যোগ করুন।",
  },
  "cart.weight_progress_met": {
    en: "Minimum weight met.",
    bn: "ন্যূনতম ওজন পূরণ।",
  },
  "pdp.min_order_weight": {
    en: "Minimum order: {kg} kg total (across all items in your cart).",
    bn: "ন্যূনতম অর্ডার: মোট {kg} কেজি (আপনার কার্টের সব পণ্য মিলিয়ে)।",
  },
  "checkout.error.below_min_weight": {
    en: "Order must be at least {kg} kg. Add more items to your order list.",
    bn: "অর্ডার কমপক্ষে {kg} কেজি হতে হবে। আরও পণ্য যোগ করুন।",
  },

  // ── Checkout / order ──────────────────────────────────────────────
  "checkout.title": { en: "Checkout", bn: "চেকআউট" },
  "checkout.subtitle": {
    en: "Review your order, add a delivery address, then submit. The landed cost (shipping + customs + tax) is shared by email or WhatsApp after you place the order — you pay the amount we confirm.",
    bn: "অর্ডারটি পর্যালোচনা করুন, ডেলিভারি ঠিকানা দিন, তারপর জমা দিন। ল্যান্ডেড খরচ (শিপিং + কাস্টমস + ট্যাক্স) অর্ডার দেওয়ার পর ইমেইল বা হোয়াটসঅ্যাপে জানানো হবে — আমরা যে পরিমাণ নিশ্চিত করি, সেটাই আপনি পেমেন্ট করবেন।",
  },
  "checkout.address": { en: "Delivery address", bn: "ডেলিভারি ঠিকানা" },
  "checkout.address.help": {
    en: "We deliver across Bangladesh. The landed cost is confirmed by our team after you place the order.",
    bn: "আমরা সারা বাংলাদেশে ডেলিভারি দিই। ল্যান্ডেড খরচ অর্ডার দেওয়ার পর আমাদের টিম নিশ্চিত করবে।",
  },
  "checkout.full_name": { en: "Full name", bn: "পুরো নাম" },
  "checkout.full_name_ph": { en: "e.g. Rahim Mia", bn: "যেমন রহিম মিয়া" },
  "checkout.phone": { en: "Phone (bKash / WhatsApp)", bn: "ফোন (বিকাশ / হোয়াটসঅ্যাপ)" },
  "checkout.district": { en: "Area / district", bn: "এলাকা / জেলা" },
  "checkout.district_ph": { en: "e.g. Gulshan, Dhaka", bn: "যেমন গুলশান, ঢাকা" },
  "checkout.address_line": { en: "Address line", bn: "ঠিকানা" },
  "checkout.address_line_ph": {
    en: "House, road, landmark",
    bn: "বাড়ি, রোড, ল্যান্ডমার্ক",
  },
  "checkout.buyer_note": { en: "Note to seller (optional)", bn: "বিক্রেতাকে নোট (ঐচ্ছিক)" },
  "checkout.buyer_note_ph": {
    en: "e.g. Call before delivery, deliver after 6pm",
    bn: "যেমন ডেলিভারির আগে কল করুন, সন্ধ্যা ৬টার পরে দিন",
  },
  "checkout.shipping": { en: "Shipping mode", bn: "শিপিং মোড" },
  "checkout.shipping.air": { en: "Air freight (7–12 days)", bn: "এয়ার ফ্রেইট (৭-১২ দিন)" },
  "checkout.shipping.sea": { en: "Sea freight LCL (35–45 days)", bn: "সি ফ্রেইট LCL (৩৫-৪৫ দিন)" },
  "checkout.shipping.help": {
    en: "Sea is ~৳10,000/CBM but takes 5+ weeks. Air is 7–12 days, charged per kg.",
    bn: "সি প্রায় ৳১০,০০০/CBM কিন্তু ৫+ সপ্তাহ লাগে। এয়ার ৭-১২ দিন, প্রতি কেজিতে চার্জ।",
  },
  "checkout.payment": { en: "Payment method", bn: "পেমেন্ট পদ্ধতি" },
  "checkout.payment.bkash": {
    en: "bKash (Personal)",
    bn: "বিকাশ (পার্সোনাল)",
  },
  "checkout.payment.bkash_help": {
    en: "Send the full amount to 0173-25764171. Reference your order number.",
    bn: "সম্পূর্ণ পরিমাণ ০১৭৩-২৫৭৬৪১৭১ নম্বরে পাঠান। অর্ডার নম্বর রেফারেন্সে দিন।",
  },
  "checkout.payment.bank": { en: "Bank transfer", bn: "ব্যাংক ট্রান্সফার" },
  "checkout.payment.bank_help": {
    en: "City Bank, A/C 1234-567890-1, Beneficiary: Skybuy Limited.",
    bn: "সিটি ব্যাংক, হিসাব ১২৩৪-৫৬৭৮৯০-১, বেনিফিশিয়ারি: স্কাইবুই লিমিটেড।",
  },
  "checkout.payment.cod": { en: "Cash on pickup", bn: "পিকআপে নগদ" },
  "checkout.payment.cod_help": {
    en: "Pay the full amount in cash at our Badda warehouse on pickup.",
    bn: "পিকআপের সময় আমাদের বাড্ডা গুদামে সম্পূর্ণ পরিমাণ নগদ দিন।",
  },
  "checkout.payment.usdt": { en: "USDT (TRC20)", bn: "USDT (TRC20)" },
  "checkout.payment.usdt_help": {
    en: "0% spread, network fee ~$1. Wallet: TXyz... (shown after order is placed).",
    bn: "০% স্প্রেড, নেটওয়ার্ক ফি ~$১। ওয়ালেট: TXyz... (অর্ডার দেওয়ার পর দেখানো হবে)।",
  },
  "checkout.summary": { en: "Order summary", bn: "অর্ডার সারাংশ" },
  "checkout.summary.items": { en: "Items", bn: "আইটেম" },
  "checkout.summary.subtotal": { en: "Product subtotal", bn: "পণ্য সাবটোটাল" },
  "checkout.summary.shipping": { en: "Shipping + agent", bn: "শিপিং + এজেন্ট" },
  "checkout.summary.duty": { en: "Customs duty", bn: "কাস্টমস শুল্ক" },
  "checkout.summary.tax": { en: "VAT + AIT", bn: "ভ্যাট + এআইটি" },
  "checkout.summary.total": { en: "Total landed in Dhaka", bn: "ঢাকায় মোট ল্যান্ডেড" },
  "checkout.summary.deposit": { en: "Amount to pay", bn: "প্রদেয় পরিমাণ" },
  "checkout.summary.balance": { en: "(confirmed after order)", bn: "(অর্ডারের পর নিশ্চিত)" },
  "checkout.summary.deposit_help": {
    en: "The landed cost (shipping + customs + tax) is shared by email or WhatsApp after you place the order. You pay the amount we confirm.",
    bn: "ল্যান্ডেড খরচ (শিপিং + কাস্টমস + ট্যাক্স) অর্ডার দেওয়ার পর ইমেইল বা হোয়াটসঅ্যাপে জানানো হবে। আমরা যে পরিমাণ নিশ্চিত করি, সেটাই আপনি পেমেন্ট করবেন।",
  },
  "checkout.place": { en: "Place order", bn: "অর্ডার দিন" },
  "checkout.placing": { en: "Placing order…", bn: "অর্ডার দিচ্ছি…" },
  "checkout.empty": { en: "Your order list is empty.", bn: "আপনার অর্ডার তালিকা খালি।" },
  "checkout.empty.cta": { en: "Browse the catalog", bn: "ক্যাটালগ দেখুন" },
  "checkout.sign_in": {
    en: "Sign in to place an order.",
    bn: "অর্ডার দিতে সাইন ইন করুন।",
  },
  "checkout.error.address": {
    en: "Please fill in your full name, phone, area, and address.",
    bn: "আপনার নাম, ফোন, এলাকা ও ঠিকানা পূরণ করুন।",
  },
  "checkout.error.network": {
    en: "Could not place the order. Please try again.",
    bn: "অর্ডার দেওয়া যায়নি। আবার চেষ্টা করুন।",
  },
  "checkout.error.unauth": {
    en: "Please sign in to continue.",
    bn: "চালিয়ে যেতে সাইন ইন করুন।",
  },
  "checkout.note.thanks": {
    en: "✓ Order placed. We'll review and confirm within 2 hours.",
    bn: "✓ অর্ডার গৃহীত। আমরা ২ ঘণ্টার মধ্যে নিশ্চিত করব।",
  },

  // ── Order detail page ─────────────────────────────────────────────
  "order.title": { en: "Order", bn: "অর্ডার" },
  "order.status.pending_payment": { en: "Awaiting payment", bn: "পেমেন্ট অপেক্ষমান" },
  "order.status.paid": { en: "Payment received", bn: "পেমেন্ট গৃহীত" },
  "order.status.in_transit": { en: "In transit", bn: "ট্রানজিটে" },
  "order.status.delivered": { en: "Delivered", bn: "ডেলিভারড" },
  "order.status.cancelled": { en: "Cancelled", bn: "বাতিল" },
  "order.payment_instructions": {
    en: "Payment instructions",
    bn: "পেমেন্ট নির্দেশনা",
  },
  "order.payment_help": {
    en: "Our team will email or WhatsApp you the landed cost (shipping + customs + tax) within a few hours of order. Send the amount they confirm to the bKash number below, with this order number as reference.",
    bn: "অর্ডারের কয়েক ঘণ্টার মধ্যে আমাদের টিম ইমেইল বা হোয়াটসঅ্যাপে ল্যান্ডেড খরচ (শিপিং + কাস্টমস + ট্যাক্স) জানাবে। তারা যে পরিমাণ নিশ্চিত করবে, সেটি নিচের বিকাশ নম্বরে পাঠান, রেফারেন্সে এই অর্ডার নম্বরটি দিন।",
  },
  "order.amount_to_pay": {
    en: "Amount to pay",
    bn: "প্রদেয় পরিমাণ",
  },
  "order.amount_after_confirm": {
    en: "Will be confirmed by email or WhatsApp",
    bn: "ইমেইল বা হোয়াটসঅ্যাপে নিশ্চিত করা হবে",
  },
  "order.mark_paid": {
    en: "I sent the payment",
    bn: "আমি পেমেন্ট পাঠিয়েছি",
  },
  "order.paid_at": {
    en: "Payment received",
    bn: "পেমেন্ট গৃহীত",
  },
  "order.pay_total": {
    en: "Amount to pay",
    bn: "প্রদেয় পরিমাণ",
  },
  "order.full_prepay_note": {
    en: "Our team confirms the amount by email or WhatsApp after you place the order. You pay the amount they send.",
    bn: "অর্ডার দেওয়ার পর আমাদের টিম ইমেইল বা হোয়াটসঅ্যাপে পরিমাণ নিশ্চিত করবে। তারা যে পরিমাণ পাঠায়, সেটাই আপনি দেবেন।",
  },
  "order.buyer_info": { en: "Buyer info", bn: "ক্রেতার তথ্য" },
  "order.address": { en: "Delivery address", bn: "ডেলিভারি ঠিকানা" },
  "order.items": { en: "Items", bn: "আইটেম" },
  "order.line_unit": { en: "Unit price", bn: "একক মূল্য" },
  "order.line_qty": { en: "Qty", bn: "পরিমাণ" },
  "order.line_subtotal": { en: "Line subtotal", bn: "লাইন সাবটোটাল" },
  "order.placed_on": { en: "Placed on", bn: "অর্ডার করা হয়েছে" },
  "order.shipping_mode": { en: "Shipping mode", bn: "শিপিং মোড" },
  "order.summary": { en: "Order summary", bn: "অর্ডার সারাংশ" },

  // ── Search ────────────────────────────────────────────────────────
  "search.placeholder": {
    en: "Search products",
    bn: "পণ্য অনুসন্ধান",
  },
  "search.aria": { en: "Search products", bn: "পণ্য অনুসন্ধান" },
  "search.empty": { en: "No matches. Try another keyword.", bn: "কোনো মিল নেই। অন্য কীওয়ার্ড চেষ্টা করুন।" },
  "search.view_all": { en: "See all results", bn: "সব ফলাফল দেখুন" },
  "search.esc": { en: "Press Esc to close", bn: "বন্ধ করতে Esc চাপুন" },

  // ── Login ─────────────────────────────────────────────────────────
  "login.title": { en: "Sign in", bn: "সাইন ইন" },
  "login.lede": {
    en: "Save your order list, view quotes, and pay in bKash, Nagad, or bank.",
    bn: "অর্ডার তালিকা সংরক্ষণ করুন, কোট দেখুন, এবং বিকাশ, নগদ, বা ব্যাংকে পেমেন্ট করুন।",
  },
  "login.email": { en: "Email", bn: "ইমেইল" },
  "login.email_ph": { en: "you@business.bd", bn: "you@business.bd" },
  "login.send_otp": { en: "Send OTP", bn: "OTP পাঠান" },
  "login.otp_sent": {
    en: "OTP sent to your email. (Stub: 1234)",
    bn: "আপনার ইমেইলে OTP পাঠানো হয়েছে। (স্টাব: 1234)",
  },
  "login.otp": { en: "4-digit OTP", bn: "৪ সংখ্যার OTP" },
  "login.verify": { en: "Verify and sign in", bn: "যাচাই করে সাইন ইন" },
  "login.skip": { en: "Continue without account", bn: "অ্যাকাউন্ট ছাড়া চালিয়ে যান" },
  "login.guest_title": { en: "Browsing as guest", bn: "অতিথি হিসেবে ব্রাউজ করছেন" },
  "login.guest_body": {
    en: "You can add to your order list. We'll ask for an email before you request a quote.",
    bn: "আপনি অর্ডার তালিকায় যোগ করতে পারবেন। কোটের আগে আমরা ইমেইল চাইব।",
  },
  "login.out": { en: "Sign out", bn: "সাইন আউট" },

  // ── Login UX (Phase 46, 2026-06-18) ──────────────────────────────
  // Split-pane marketing pane + tabbed signin/signup + password
  // strength meter + forgot-password flow. All previous hardcoded
  // English strings in _client.tsx are now properly localized.
  "login.headline": {
    en: "Wholesale direct from China, priced in BDT.",
    bn: "সরাসরি চীন থেকে পাইকারি, বিডিটি মূল্যে।",
  },
  "login.subhead": {
    en: "Hand-picked products, factory-direct pricing, all-in-one BDT unit price.",
    bn: "বাছাই করা পণ্য, কারখানা-সরাসরি মূল্য, সব-একটি বিডিটি ইউনিট মূল্য।",
  },
  "login.bullet1": {
    en: "Factory-direct pricing, no middlemen",
    bn: "কারখানা-সরাসরি মূল্য, কোনো মধ্যস্থতাকারী নেই",
  },
  "login.bullet2": {
    en: "All-in BDT — shipping + customs duty included",
    bn: "সব বিডিটিতে — শিপিং + কাস্টমস শুল্ক অন্তর্ভুক্ত",
  },
  "login.bullet3": {
    en: "Photo QC on every order, before ship",
    bn: "প্রতিটি অর্ডারে ছবি QC, শিপের আগে",
  },
  "login.signin_tab": { en: "Sign in", bn: "সাইন ইন" },
  "login.signup_tab": { en: "Create account", bn: "অ্যাকাউন্ট তৈরি করুন" },
  "login.signin_lede": {
    en: "Welcome back. Sign in to view your orders, quotes, and watchlist.",
    bn: "স্বাগতম। আপনার অর্ডার, কোট এবং ওয়াচলিস্ট দেখতে সাইন ইন করুন।",
  },
  "login.signup_lede": {
    en: "Free account. No credit card. 30-second setup.",
    bn: "বিনামূল্যে অ্যাকাউন্ট। কোনো ক্রেডিট কার্ড নেই। ৩০ সেকেন্ডে সেটআপ।",
  },
  "login.signin_cta": { en: "Sign in", bn: "সাইন ইন" },
  "login.signin_cta_admin": { en: "Open admin →", bn: "অ্যাডমিন খুলুন →" },
  "login.signin_cta_buyer": {
    en: "Open buyer dashboard →",
    bn: "ক্রেতা ড্যাশবোর্ড খুলুন →",
  },
  "login.signup_cta": { en: "Create account", bn: "অ্যাকাউন্ট তৈরি করুন" },
  "login.password_label": { en: "Password", bn: "পাসওয়ার্ড" },
  "login.password_ph": {
    en: "At least 8 characters",
    bn: "কমপক্ষে ৮টি অক্ষর",
  },
  "login.show_password": { en: "Show", bn: "দেখান" },
  "login.hide_password": { en: "Hide", bn: "লুকান" },
  "login.forgot_link": { en: "Forgot password?", bn: "পাসওয়ার্ড ভুলে গেছেন?" },
  "login.forgot_heading": {
    en: "Reset your password",
    bn: "আপনার পাসওয়ার্ড রিসেট করুন",
  },
  "login.forgot_body": {
    en: "Enter your email and we'll send a reset link.",
    bn: "আপনার ইমেইল দিন এবং আমরা একটি রিসেট লিঙ্ক পাঠাব।",
  },
  "login.forgot_cta": { en: "Send reset link", bn: "রিসেট লিঙ্ক পাঠান" },
  "login.forgot_sent": {
    en: "If an account exists for {email}, you'll receive a reset link shortly.",
    bn: "{email} এর জন্য একটি অ্যাকাউন্ট থাকলে, আপনি শীঘ্রই একটি রিসেট লিঙ্ক পাবেন।",
  },
  "login.forgot_back": { en: "← Back to sign in", bn: "← সাইন ইনে ফিরে যান" },
  "login.signing_in": { en: "Signing in…", bn: "সাইন ইন হচ্ছে…" },
  "login.creating_account": { en: "Creating account…", bn: "অ্যাকাউন্ট তৈরি হচ্ছে…" },
  "login.sending": { en: "Sending…", bn: "পাঠানো হচ্ছে…" },
  "login.check_email_heading": {
    en: "Check your email",
    bn: "আপনার ইমেইল চেক করুন",
  },
  "login.check_email_body": {
    en: "We've sent a confirmation link to {email}. Click it to activate your account.",
    bn: "আমরা {email} এ একটি নিশ্চিতকরণ লিঙ্ক পাঠিয়েছি। আপনার অ্যাকাউন্ট সক্রিয় করতে এটিতে ক্লিক করুন।",
  },
  "login.check_email_help": {
    en: "Didn't get it? Check your spam folder, or wait a minute and try again.",
    bn: "পাননি? স্প্যাম ফোল্ডার চেক করুন, অথবা এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।",
  },
  "login.password_strength_label": {
    en: "Strength:",
    bn: "শক্তি:",
  },
  "login.password_strength_weak": { en: "Weak", bn: "দুর্বল" },
  "login.password_strength_ok": { en: "OK", bn: "ঠিক আছে" },
  "login.password_strength_strong": { en: "Strong", bn: "শক্তিশালী" },
  "login.password_tip_length": {
    en: "8+ characters",
    bn: "৮+ অক্ষর",
  },
  "login.password_tip_mix": {
    en: "Letters + numbers",
    bn: "অক্ষর + সংখ্যা",
  },
  "login.password_tip_symbol": {
    en: "Add a symbol (!@#$)",
    bn: "একটি চিহ্ন যোগ করুন (!@#$)",
  },
  "login.have_account": {
    en: "Already have an account? Sign in",
    bn: "ইতিমধ্যে অ্যাকাউন্ট আছে? সাইন ইন করুন",
  },
  "login.need_account": {
    en: "Need an account? Create one",
    bn: "অ্যাকাউন্ট দরকার? একটি তৈরি করুন",
  },

  // ── Group buy (Phase 37) ──────────────────────────────────────────
  // The admin + public surfaces use a mix of these. Status labels
  // (open/forming/formed/expired/cancelled) are intentionally kept
  // in English-only via the STATUS_LABEL map in the page — they're
  // operators, not end-user copy. The buyer-facing copy lives
  // under group_buy.public.* (Phase 39 adds the rest).
  "group_buy.admin.title": {
    en: "Group buys",
    bn: "গ্রুপ বায়",
  },
  "group_buy.admin.subtitle": {
    en: "Pay-on-success bulk deals. Buyers commit a qty; when the group's target is met by the deadline, every member is charged at the final tiered price.",
    bn: "পে-অন-সাকসেস বাল্ক ডিল। ক্রেতারা পরিমাণ কমিট করে; ডেডলাইনের মধ্যে গ্রুপের টার্গেট পূরণ হলে প্রতিটি সদস্যকে চূড়ান্ত টায়ার্ড মূল্যে চার্জ করা হয়।",
  },
  "group_buy.admin.create": {
    en: "+ Create group buy",
    bn: "+ গ্রুপ বায় তৈরি করুন",
  },
  "group_buy.admin.create_title": {
    en: "Create group buy",
    bn: "গ্রুপ বায় তৈরি করুন",
  },
  "group_buy.admin.create_subtitle": {
    en: "Set a target quantity, a deadline, and a tiered step-down price ladder. Buyers commit a qty; when SUM of all members hits target, every member is charged at the final tiered price.",
    bn: "একটি টার্গেট পরিমাণ, ডেডলাইন এবং টায়ার্ড স্টেপ-ডাউন মূল্য সেট করুন। ক্রেতারা পরিমাণ কমিট করে; সব সদস্যের মোট টার্গেটে পৌঁছালে প্রতিটি সদস্যকে চূড়ান্ত মূল্যে চার্জ করা হয়।",
  },
  "group_buy.admin.field.product": { en: "Product", bn: "পণ্য" },
  "group_buy.admin.field.target_qty": {
    en: "Target quantity (pcs)",
    bn: "টার্গেট পরিমাণ (পিস)",
  },
  "group_buy.admin.field.target_qty_hint": {
    en: "Sum of all members' qty to form the group",
    bn: "গ্রুপ গঠনের জন্য সব সদস্যের মোট পরিমাণ",
  },
  "group_buy.admin.field.min_qty": {
    en: "Min per buyer (pcs)",
    bn: "প্রতি ক্রেতা সর্বনিম্ন (পিস)",
  },
  "group_buy.admin.field.deadline": { en: "Deadline", bn: "ডেডলাইন" },
  "group_buy.admin.field.tiers": { en: "Price tiers", bn: "মূল্য স্তর" },
  "group_buy.admin.cancel": { en: "Cancel group buy", bn: "গ্রুপ বায় বাতিল" },
  "group_buy.admin.cancel_confirm": {
    en: "Cancel this group buy? This is final — buyers will be notified and no charge will happen.",
    bn: "এই গ্রুপ বায় বাতিল করবেন? এটি চূড়ান্ত — ক্রেতাদের জানানো হবে এবং কোনো চার্জ হবে না।",
  },
  "group_buy.admin.empty": {
    en: "No group buys yet.",
    bn: "এখনও কোনো গ্রুপ বায় নেই।",
  },
  "group_buy.admin.members": { en: "Members", bn: "সদস্য" },
  "group_buy.admin.committed": { en: "Committed", bn: "কমিটেড" },
  "group_buy.admin.progress": { en: "Progress", bn: "অগ্রগতি" },
  "group_buy.admin.preview_title": {
    en: "Buyer view preview",
    bn: "ক্রেতা ভিউ প্রিভিউ",
  },
  "group_buy.admin.pricing_ladder": {
    en: "Pricing ladder",
    bn: "মূল্য সিঁড়ি",
  },

  // ── Group buy (Phase 39) — public buyer-facing ─────────────────
  // The listing page + the public detail page + the buyer-side
  // "my groups" list all consume these keys.

  // Listing page (/group-buys)
  "group_buy.public.title": {
    en: "Group buys",
    bn: "গ্রুপ বায়",
  },
  "group_buy.public.subtitle": {
    en: "Pay-on-success bulk deals. Commit a quantity; when the group's target is met by the deadline, every member is charged at the final tiered price.",
    bn: "পে-অন-সাকসেস বাল্ক ডিল। পরিমাণ কমিট করুন; ডেডলাইনের মধ্যে টার্গেট পূরণ হলে প্রতিটি সদস্যকে চূড়ান্ত টায়ার্ড মূল্যে চার্জ করা হয়।",
  },
  "group_buy.public.filter.all": { en: "All", bn: "সব" },
  "group_buy.public.filter.sort.deadline": {
    en: "Ending soonest",
    bn: "শীঘ্রই শেষ হবে",
  },
  "group_buy.public.filter.sort.progress": {
    en: "Most progress",
    bn: "সর্বাধিক অগ্রগতি",
  },
  "group_buy.public.card.committed": {
    en: "committed",
    bn: "কমিটেড",
  },
  "group_buy.public.card.buyers": { en: "buyers", bn: "জন ক্রেতা" },
  "group_buy.public.card.ends_in": { en: "Ends in", bn: "শেষ হবে" },
  "group_buy.public.card.ends_passed": { en: "Ended", bn: "শেষ হয়েছে" },
  "group_buy.public.card.unlocks_at": {
    en: "{qty} more for",
    bn: "{qty} আরও হলে",
  },
  "group_buy.public.empty": {
    en: "No active group buys right now. Check back soon.",
    bn: "এখন কোনো সক্রিয় গ্রুপ বায় নেই। শীঘ্রই আবার দেখুন।",
  },

  // Detail page (/group-buys/[id])
  "group_buy.public.detail.eyebrow": {
    en: "Group buy",
    bn: "গ্রুপ বায়",
  },
  "group_buy.public.detail.progress_label": {
    en: "Progress",
    bn: "অগ্রগতি",
  },
  "group_buy.public.detail.buyers_label": {
    en: "Buyers committed",
    bn: "কমিটেড ক্রেতা",
  },
  "group_buy.public.detail.target_label": {
    en: "Target quantity",
    bn: "টার্গেট পরিমাণ",
  },
  "group_buy.public.detail.deadline_label": {
    en: "Deadline",
    bn: "ডেডলাইন",
  },
  "group_buy.public.detail.current_price": {
    en: "Current price (everyone pays this when the group forms)",
    bn: "বর্তমান মূল্য (গ্রুপ গঠন হলে সবাই এই মূল্যে পাবে)",
  },
  "group_buy.public.detail.next_tier_hint": {
    en: "{qty} more pcs to unlock {price}/pc",
    bn: "{price}/pc আনলক করতে আরও {qty} পিস",
  },
  "group_buy.public.detail.tiers_title": {
    en: "Price tiers — everyone pays the lowest tier reached when the group forms",
    bn: "মূল্য স্তর — গ্রুপ গঠন হলে সবাই সবচেয়ে কম পৌঁছানো স্তরে পাবে",
  },
  "group_buy.public.detail.tier_unlocked": { en: "Unlocked", bn: "আনলকড" },
  "group_buy.public.detail.tier_next": { en: "Next", bn: "পরবর্তী" },
  "group_buy.public.detail.min_per_buyer": {
    en: "Minimum per buyer: {qty} pcs",
    bn: "প্রতি ক্রেতা সর্বনিম্ন: {qty} পিস",
  },
  "group_buy.public.detail.qty_label": {
    en: "Quantity to commit",
    bn: "কমিট করার পরিমাণ",
  },
  "group_buy.public.detail.you_pay": {
    en: "You'll commit {qty} pcs at {price}/pc = {total}",
    bn: "আপনি {qty} পিস কমিট করবেন {price}/pc = {total}",
  },
  "group_buy.public.detail.join_cta": { en: "Join now", bn: "এখনই যোগ দিন" },
  "group_buy.public.detail.signin_cta": {
    en: "Sign in to join",
    bn: "যোগ দিতে সাইন ইন করুন",
  },
  "group_buy.public.detail.cancel_cta": {
    en: "Cancel my commitment",
    bn: "আমার কমিটমেন্ট বাতিল",
  },
  "group_buy.public.detail.already_in": {
    en: "You're in — {qty} pcs committed at {price}/pc",
    bn: "আপনি আছেন — {qty} পিস {price}/pc এ কমিটেড",
  },
  "group_buy.public.detail.already_in_explainer": {
    en: "You'll be charged when the group forms. You can cancel before the deadline.",
    bn: "গ্রুপ গঠন হলে আপনাকে চার্জ করা হবে। ডেডলাইনের আগে বাতিল করতে পারবেন।",
  },
  "group_buy.public.detail.formed": {
    en: "Group formed at {price}/pc — orders created.",
    bn: "গ্রুপ গঠিত {price}/pc এ — অর্ডার তৈরি হয়েছে।",
  },
  "group_buy.public.detail.expired": {
    en: "This group buy didn't reach its target. No charge happened.",
    bn: "এই গ্রুপ বায় টার্গেট পূরণ করতে পারেনি। কোনো চার্জ হয়নি।",
  },
  "group_buy.public.detail.cancelled": {
    en: "This group buy was cancelled. No charge happened.",
    bn: "এই গ্রুপ বায় বাতিল করা হয়েছে। কোনো চার্জ হয়নি।",
  },
  "group_buy.public.detail.forming": {
    en: "Group is forming — your order is being created.",
    bn: "গ্রুপ গঠন হচ্ছে — আপনার অর্ডার তৈরি হচ্ছে।",
  },
  "group_buy.public.detail.view_product": {
    en: "View product details",
    bn: "পণ্যের বিস্তারিত",
  },
  "group_buy.public.detail.how_it_works": {
    en: "How group buys work",
    bn: "গ্রুপ বায় কীভাবে কাজ করে",
  },
  "group_buy.public.detail.how_it_works_body": {
    en: "1) Commit a quantity at the current tier price. 2) If the group's target is reached by the deadline, every member is charged the same (lowest-tier-reached) price. 3) If the target isn't reached, no charge happens and your commitment is released.",
    bn: "১) বর্তমান স্তরের মূল্যে পরিমাণ কমিট করুন। ২) ডেডলাইনের মধ্যে টার্গেট পূরণ হলে সবাই একই (সবচেয়ে কম-পৌঁছানো-স্তর) মূল্যে পাবে। ৩) টার্গেট পূরণ না হলে কোনো চার্জ হবে না এবং আপনার কমিটমেন্ট মুক্ত হবে।",
  },
  "group_buy.public.detail.min_not_met": {
    en: "Minimum per buyer is {qty} pcs",
    bn: "প্রতি ক্রেতা সর্বনিম্ন {qty} পিস",
  },
  "group_buy.public.detail.qty_step_hint": {
    en: "Step: {step} pcs",
    bn: "ধাপ: {step} পিস",
  },

  // Buyer-side "my groups" page (/buyer/group-buys)
  "group_buy.my.title": {
    en: "My group buys",
    bn: "আমার গ্রুপ বায়",
  },
  "group_buy.my.subtitle": {
    en: "Every group buy you've committed to, current status, and your locked-in price.",
    bn: "আপনি যে সব গ্রুপ বায়-তে কমিট করেছেন, বর্তমান অবস্থা এবং আপনার লক করা মূল্য।",
  },
  "group_buy.my.empty": {
    en: "You haven't joined any group buys yet.",
    bn: "আপনি এখনও কোনো গ্রুপ বায়-তে যোগ দেননি।",
  },
  "group_buy.my.empty_cta": {
    en: "Browse active group buys",
    bn: "সক্রিয় গ্রুপ বায় দেখুন",
  },
  "group_buy.my.status_label": { en: "Status", bn: "অবস্থা" },
  "group_buy.my.your_qty": {
    en: "Your qty: {qty} pcs",
    bn: "আপনার পরিমাণ: {qty} পিস",
  },
  "group_buy.my.your_price_locked": {
    en: "Locked at: {price}/pc",
    bn: "লক করা মূল্য: {price}/pc",
  },
  "group_buy.my.will_pay": {
    en: "You'll pay at formation: {price}/pc",
    bn: "গঠনের সময় আপনি দেবেন: {price}/pc",
  },
  "group_buy.my.price_dropped": {
    en: "Price has dropped since you joined — you're locked at {price}/pc.",
    bn: "আপনার যোগদানের পর থেকে মূল্য কমেছে — আপনি {price}/pc এ লক আছেন।",
  },
  "group_buy.my.action.view": { en: "View group", bn: "গ্রুপ দেখুন" },
  "group_buy.my.action.pay_now": {
    en: "Pay now — order #{orderId}",
    bn: "এখনই পেমেন্ট — অর্ডার #{orderId}",
  },
  "group_buy.my.action.cancel": {
    en: "Cancel my commitment",
    bn: "আমার কমিটমেন্ট বাতিল",
  },
  "group_buy.my.action.failed_retry": {
    en: "Order failed — contact support",
    bn: "অর্ডার ব্যর্থ — সাপোর্টে যোগাযোগ",
  },
  "group_buy.my.progress_label": {
    en: "Group progress",
    bn: "গ্রুপের অগ্রগতি",
  },
};

/** Server-safe: render a key in a chosen language. */
export function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}
