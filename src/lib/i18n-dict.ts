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

  // ── Home: single-slide hero (Phase 26, hand-picked since 2026-06-15) ──
  // Eyebrow no longer references 1688 or live sync — we hand-pick.
  "home.hero.eyebrow": {
    en: "Hand-picked · {count} products · updated today",
    bn: "হাতে বাছাই · {count}টি পণ্য · আজ আপডেট",
  },
  "home.hero.title": {
    en: "Hand-picked China, in your currency.",
    bn: "হাতে বাছাই চীনা পণ্য, আপনার মুদ্রায়।",
  },
  "home.hero.subhead": {
    en: "{count} trending products from Pinduoduo, Taobao, and other China sources, hand-curated by our team. One all-in BDT price — factory, freight, customs, and our 3% service fee. Nothing hidden.",
    bn: "{count}টি ট্রেন্ডি পণ্য পিন্ডুডুও, তাওবাও এবং অন্যান্য চীনা উৎস থেকে, আমাদের টিম সাবধানে বাছাই করেছে। একটি সব-অন্তর্ভুক্ত বিডিটি মূল্যে — কারখানা, ফ্রেইট, কাস্টমস এবং আমাদের ৩% সার্ভিস ফি। কিছুই লুকানো নেই।",
  },
  "home.hero.cta.browse": { en: "Browse {count} products", bn: "{count}টি পণ্য দেখুন" },

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
    en: "8 sourcing categories, hand-picked for the Bangladesh market.",
    bn: "৮টি সোর্সিং ক্যাটাগরি, বাংলাদেশের বাজারের জন্য বাছাই করা।",
  },
  "cat.products": { en: "products", bn: "টি পণ্য" },
  "cat.from": { en: "from", bn: "থেকে" },
  "cat.view": { en: "Browse", bn: "দেখুন" },

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
};

/** Server-safe: render a key in a chosen language. */
export function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}
