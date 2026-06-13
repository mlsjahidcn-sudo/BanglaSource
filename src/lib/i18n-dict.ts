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
  "nav.signin": { en: "Sign in", bn: "সাইন ইন" },
  "nav.start_order": { en: "Start an order", bn: "অর্ডার শুরু করুন" },
  "nav.all_categories": { en: "All categories", bn: "সব ক্যাটাগরি" },
  "nav.search_placeholder": {
    en: "Search products · TWS earbuds, sunglasses, handbags…",
    bn: "পণ্য খুঁজুন · TWS ইয়ারবাড, সানগ্লাস, হ্যান্ডব্যাগ…",
  },

  // ── Home: hero slider (Amazon-style carousel) ─────────────────────
  "home.slider.eyebrow": {
    en: "Bulk wholesale, made simple",
    bn: "বাল্ক হোলসেল, সহজ করা",
  },
  "home.slider.s1.eyebrow": { en: "New · Spring 2026 catalog", bn: "নতুন · বসন্ত ২০২৬ ক্যাটালগ" },
  "home.slider.s1.title": {
    en: "Factory prices, in your currency.",
    bn: "কারখানার দাম, আপনার মুদ্রায়।",
  },
  "home.slider.s1.body": {
    en: "1,200+ verified factories. One all-in price. Shipped to your shop in 12–18 days.",
    bn: "১,২০০+ যাচাইকৃত কারখানা। একটি সব-অন্তর্ভুক্ত মূল্য। ১২-১৮ দিনে আপনার দোকানে।",
  },
  "home.slider.s1.cta": { en: "Browse the catalog", bn: "ক্যাটালগ দেখুন" },

  "home.slider.s2.eyebrow": { en: "Quality you can verify", bn: "আপনি যাচাই করতে পারেন এমন মান" },
  "home.slider.s2.title": {
    en: "Photo QC on every order.",
    bn: "প্রতিটি অর্ডারে ছবি QC।",
  },
  "home.slider.s2.body": {
    en: "Our team opens, counts, and photographs your goods before shipping. Discrepancies caught before payment.",
    bn: "আমাদের টিম পাঠানোর আগে আপনার পণ্য খোলে, গণনা করে এবং ছবি তোলে।",
  },
  "home.slider.s2.cta": { en: "See how it works", bn: "কীভাবে কাজ করে দেখুন" },

  "home.slider.s3.eyebrow": { en: "Pay the way you want", bn: "আপনি যেভাবে চান পেমেন্ট করুন" },
  "home.slider.s3.title": {
    en: "Pay in bKash, Nagad, or bank.",
    bn: "বিকাশ, নগদ, বা ব্যাংকে পেমেন্ট।",
  },
  "home.slider.s3.body": {
    en: "Escrow holds your money until you confirm receipt. Open a dispute within 48 hours if anything is wrong.",
    bn: "আপনি রসিদ নিশ্চিত না হওয়া পর্যন্ত এসক্রো আপনার টাকা ধরে রাখে।",
  },
  "home.slider.s3.cta": { en: "Talk to us", bn: "আমাদের সাথে কথা বলুন" },

  // ── Home: left rail + strip layout ───────────────────────────────
  "home.rail.title": { en: "Shop by category", bn: "ক্যাটাগরি" },
  "home.rail.all": { en: "All categories", bn: "সব ক্যাটাগরি" },
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
    en: "Includes shipping, duty, VAT. Final price locks at checkout.",
    bn: "শিপিং, শুল্ক, ভ্যাট অন্তর্ভুক্ত। চেকআউটে চূড়ান্ত মূল্য লক হয়।",
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
    en: "8 sourcing categories, hand-picked for the Bangladesh market.",
    bn: "৮টি সোর্সিং ক্যাটাগরি, বাংলাদেশের বাজারের জন্য বাছাই করা।",
  },
  "cat.products": { en: "products", bn: "টি পণ্য" },
  "cat.from": { en: "from", bn: "থেকে" },
  "cat.view": { en: "Browse", bn: "দেখুন" },

  // ── How it works page ─────────────────────────────────────────────
  "how.title": { en: "How BanglaSource works", bn: "বাংলাসোর্স কীভাবে কাজ করে" },
  "how.subtitle": {
    en: "Seven steps from a factory search to your shop counter. Most buyers receive their first order in 12–18 days.",
    bn: "১৬৮৮ অনুসন্ধান থেকে আপনার দোকানের কাউন্টারে সাতটি ধাপে। বেশিরভাগ ক্রেতা তাদের প্রথম অর্ডার ১২-১৮ দিনে পান।",
  },

  "how.s1.title": { en: "You search or browse", bn: "আপনি অনুসন্ধান বা ব্রাউজ করুন" },
  "how.s1.body": {
    en: "Our catalog mirrors 1,200+ verified factory products, translated to English and Bangla with BDT pricing.",
    bn: "আমাদের ক্যাটালগ ইংরেজি ও বাংলায় অনুবাদ সহ ১,২০০+ যাচাইকৃত ১৬৮৮ পণ্য প্রতিফলিত করে।",
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

  // ── Shipping rates page ───────────────────────────────────────────
  "ship.title": { en: "Shipping & landed cost", bn: "শিপিং ও ল্যান্ডেড খরচ" },
  "ship.subtitle": {
    en: "Air, sea, and consolidation fees from our Guangzhou hub to your shop in Bangladesh.",
    bn: "আমাদের গুয়াংজু হাব থেকে বাংলাদেশের আপনার দোকানে এয়ার, সি ও কনসোলিডেশন ফি।",
  },
  "ship.mode.air": { en: "Air freight", bn: "এয়ার ফ্রেইট" },
  "ship.mode.sea": { en: "Sea freight (LCL)", bn: "সি ফ্রেইট (LCL)" },
  "ship.mode.express": { en: "Express (DHL/FedEx)", bn: "এক্সপ্রেস (DHL/FedEx)" },
  "ship.transit": { en: "Transit time", bn: "ট্রানজিট সময়" },
  "ship.min": { en: "Minimum", bn: "ন্যূনতম" },
  "ship.perkg": { en: "Per kg", bn: "প্রতি কেজি" },
  "ship.percbm": { en: "Per CBM", bn: "প্রতি CBM" },
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
  "ship.calc.markup": { en: "Our markup", bn: "আমাদের মার্কআপ" },
  "ship.calc.disclaimer": {
    en: "Estimate only. Final cost locks at checkout based on actual weight, current FX, and verified customs assessment.",
    bn: "শুধুমাত্র আনুমানিক। প্রকৃত ওজন, বর্তমান FX এবং যাচাইকৃত কাস্টমস মূল্যায়নের ভিত্তিতে চেকআউটে চূড়ান্ত খরচ লক হবে।",
  },
  "ship.disclaimer.title": { en: "Things to know", bn: "জানা দরকার" },
  "ship.disclaimer.1": {
    en: "Per Bangladesh Customs: each non-document shipment is capped at 30 kg per HAWB. For heavier orders we split into multiple HAWBs automatically.",
    bn: "বাংলাদেশ কাস্টমস অনুযায়ী: প্রতিটি নন-ডকুমেন্ট শিপমেন্ট প্রতি HAWB-এ ৩০ কেজি সীমাবদ্ধ। ভারী অর্ডারের জন্য আমরা স্বয়ংক্রিয়ভাবে একাধিক HAWB-তে ভাগ করি।",
  },
  "ship.disclaimer.2": {
    en: "Customs duty shown is a typical estimate per HS code chapter; your actual rate depends on the exact classification at assessment.",
    bn: "দেখানো কাস্টমস শুল্ক HS কোড চ্যাপ্টার অনুযায়ী সাধারণ আনুমানিক; মূল্যায়নের সময় সঠিক শ্রেণীবিভাগের উপর নির্ভর করে আপনার প্রকৃত হার।",
  },
  "ship.disclaimer.3": {
    en: "Volume is calculated from packaging dimensions, not item weight alone. Bulky-but-light items (e.g. cushions) may be charged by CBM, not kg.",
    bn: "ভলিউম প্যাকেজিং মাত্রা থেকে গণনা করা হয়, শুধু ওজন থেকে নয়। বাল্কি-কিন্তু-হালকা পণ্য (যেমন কুশন) CBM অনুযায়ী চার্জ হতে পারে।",
  },

  // ── Footer ────────────────────────────────────────────────────────
  "footer.tagline": {
    en: "Bulk wholesale, made simple. One all-in price, no surprises.",
    bn: "বাল্ক হোলসেল, সহজ করা। একটি সব-অন্তর্ভুক্ত মূল্য, কোনো চমক নেই।",
  },
  "footer.company": { en: "Company", bn: "কোম্পানি" },
  "footer.sourcing": { en: "Sourcing", bn: "সোর্সিং" },
  "footer.categories": { en: "Categories", bn: "ক্যাটাগরি" },
  "footer.stay_updated": { en: "Stay updated", bn: "আপডেট থাকুন" },
  "footer.newsletter_blurb": {
    en: "Weekly drops, restock alerts, price changes. ~1 email per week.",
    bn: "সাপ্তাহিক নতুন পণ্য, রিস্টক সতর্কতা, মূল্য পরিবর্তন। সপ্তাহে ~১টি ইমেইল।",
  },
  "footer.email_placeholder": {
    en: "you@email.com",
    bn: "আপনার@ইমেইল.কম",
  },
  "footer.subscribe": { en: "Subscribe", bn: "সাবস্ক্রাইব" },
  "footer.subscribed": {
    en: "✓ You're in. Check your inbox.",
    bn: "✓ আপনি সাবস্ক্রাইব করেছেন। ইনবক্স দেখুন।",
  },
  "footer.payments": { en: "Payment methods", bn: "পেমেন্ট পদ্ধতি" },
  "footer.payments_blurb": {
    en: "We accept bank transfer, mobile wallets, and crypto. 70/30 split, balance on delivery in Dhaka.",
    bn: "আমরা ব্যাংক ট্রান্সফার, মোবাইল ওয়ালেট এবং ক্রিপ্টো গ্রহণ করি। ৭০/৩০ বিভাজন, বাকি ঢাকায় ডেলিভারিতে।",
  },
  "footer.trade_license": {
    en: "Trade License: TRAD/DSCC/023758/2021",
    bn: "ট্রেড লাইসেন্স: TRAD/DSCC/023758/2021",
  },
  "footer.legal": { en: "Legal", bn: "আইনি" },
  "footer.privacy": { en: "Privacy", bn: "গোপনীয়তা" },
  "footer.terms": { en: "Terms", bn: "শর্তাবলী" },
  "footer.refund": { en: "Refund policy", bn: "রিফান্ড নীতি" },
  "footer.built_in": { en: "Built in Dhaka", bn: "ঢাকায় তৈরি" },
  "footer.copyright": {
    en: "© 2026 BanglaSource. All rights reserved.",
    bn: "© ২০২৬ বাংলাসোর্স। সর্বস্বত্ব সংরক্ষিত।",
  },
  "footer.trust_strip": {
    en: "Live stats from our sourcing network",
    bn: "আমাদের সোর্সিং নেটওয়ার্কের লাইভ পরিসংখ্যান",
  },
  "footer.why.fact1_title": { en: "Verified factories.", bn: "যাচাইকৃত কারখানা।" },
  "footer.why.fact1_body": {
    en: "Every supplier on our platform has a real Chinese business license on file.",
    bn: "আমাদের প্ল্যাটফর্মের প্রতিটি সরবরাহকারীর একটি প্রকৃত চীনা ব্যবসায়িক লাইসেন্স আছে।",
  },
  "footer.why.fact2_title": { en: "70/30 split.", bn: "৭০/৩০ বিভাজন।" },
  "footer.why.fact2_body": {
    en: "70% confirms your order, 30% settles in Dhaka on delivery — never all up-front.",
    bn: "৭০% অর্ডার নিশ্চিত করে, ৩০% ঢাকায় ডেলিভারিতে সমন্বয় হয় — কখনো আগাম পুরোটা নয়।",
  },
  "footer.why.fact3_title": { en: "BD + CN support.", bn: "বাংলাদেশ + চীন সাপোর্ট।" },
  "footer.why.fact3_body": {
    en: "BD WhatsApp + CN phone — answered in বাংলা, English, 中文.",
    bn: "বাংলাদেশ হোয়াটসঅ্যাপ + চীনা ফোন — বাংলা, English, 中文-এ উত্তর দেওয়া হয়।",
  },
  "footer.why.fact4_title": { en: "Door-to-door.", bn: "ঘরে ঘরে।" },
  "footer.why.fact4_body": {
    en: "Guangzhou factory → Dhaka warehouse → your shop. One tracking number.",
    bn: "গুয়াংজু কারখানা → ঢাকা গুদাম → আপনার দোকান। একটি ট্র্যাকিং নম্বর।",
  },
  "footer.credentials.label": { en: "Credentials & operations", bn: "প্রমাণপত্র ও কার্যক্রম" },
  "footer.credentials.lic_title": { en: "DSCC-licensed", bn: "DSCC লাইসেন্সপ্রাপ্ত" },
  "footer.credentials.lic_body": {
    en: "Trade License TRAD/DSCC/023758/2021",
    bn: "ট্রেড লাইসেন্স TRAD/DSCC/023758/2021",
  },
  "footer.credentials.tls_title": { en: "HTTPS everywhere", bn: "সর্বত্র HTTPS" },
  "footer.credentials.tls_body": {
    en: "TLS 1.3, HSTS, no third-party trackers on cart or checkout.",
    bn: "TLS 1.3, HSTS, কার্ট ও চেকআউটে কোনো তৃতীয়-পক্ষ ট্র্যাকার নেই।",
  },
  "footer.credentials.dhaka_title": { en: "Dhaka warehouse", bn: "ঢাকা গুদাম" },
  "footer.credentials.dhaka_body": {
    en: "Badda, Dhaka — open Sat-Thu 10:00-19:00 BST.",
    bn: "বাড্ডা, ঢাকা — শনি-বৃহঃ ১০:০০-১৯:০০ BST খোলা।",
  },
  "footer.credentials.hours_title": { en: "Replies in <2 hrs", bn: "<২ ঘণ্টায় উত্তর" },
  "footer.credentials.hours_body": {
    en: "10:00-22:00 BST, 7 days/week on WhatsApp.",
    bn: "সপ্তাহে ৭ দিন হোয়াটসঅ্যাপে ১০:০০-২২:০০ BST।",
  },
  "footer.credentials.aisearch_title": { en: "AI sourcing", bn: "AI সোর্সিং" },
  "footer.credentials.aisearch_body": {
    en: "DeepSeek-powered natural-language search and ops tools.",
    bn: "DeepSeek-চালিত প্রাকৃতিক ভাষা অনুসন্ধান ও অপস টুলস।",
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
    en: "Per-piece product prices are locked at add time. Shipping, customs duty, and VAT are added when you request a quote — see the PDP for the full breakdown.",
    bn: "পণ্যের প্রতি-পিস মূল্য অ্যাড-টাইমে লক থাকে। কোটের সময় শিপিং, শুল্ক এবং ভ্যাট যোগ হবে — সম্পূর্ণ ভাঙ্গনের জন্য PDP দেখুন।",
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
    en: "Pay now",
    bn: "এখনই পেমেন্ট",
  },
  "pdp.pay_on_delivery": {
    en: "Pay on delivery",
    bn: "ডেলিভারিতে পেমেন্ট",
  },
  "pdp.deposit_pct": {
    en: "70%",
    bn: "৭০%",
  },
  "pdp.balance_pct": {
    en: "30%",
    bn: "৩০%",
  },
  "pdp.deposit_sub": {
    en: "on order confirm",
    bn: "অর্ডার নিশ্চিতকরণে",
  },
  "pdp.balance_sub": {
    en: "on delivery · Dhaka",
    bn: "ডেলিভারিতে · ঢাকা",
  },
  "pdp.shipping_charge_label": {
    en: "Shipping + China Courier Charge",
    bn: "শিপিং + চায়না কুরিয়ার চার্জ",
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
  "pdp.details": {
    en: "Details",
    bn: "বিস্তারিত",
  },
  "pdp.customs_disclaimer": {
    // Disclaimer below the weight card. Key: framing customs as a
    // national duty the buyer pays directly to Bangladesh — not
    // a fee BanglaSource pockets. This matches SkyBuy's text.
    en: "*** Customs duty is a national duty, not our service fee! Pay the customs duty on your imported goods directly to Bangladesh. ***",
    bn: "*** উল্লেখিত পণ্যের ওজন সম্পূর্ণ সঠিক নয়, আনুমানিক মাত্র। বাংলাদেশে আসার পর পণ্যটির প্রকৃত ওজন মেপে শিপিং চার্জ হিসাব করা হবে। ***",
  },
  "cart.view_all": { en: "View full list", bn: "সম্পূর্ণ তালিকা" },
  "cart.request_quote": { en: "Request quote", bn: "কোট চান" },
  "cart.empty.title": { en: "Your order list is empty", bn: "আপনার অর্ডার তালিকা খালি" },
  "cart.empty.body": {
    en: "Add products and we'll bundle them into one quote.",
    bn: "পণ্য যোগ করুন, আমরা একটি কোটে একত্রিত করব।",
  },
  "cart.empty.cta": { en: "Browse the catalog", bn: "ক্যাটালগ দেখুন" },
  "cart.added": { en: "Added to order list", bn: "অর্ডার তালিকায় যোগ হয়েছে" },

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
};

/** Server-safe: render a key in a chosen language. */
export function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}
