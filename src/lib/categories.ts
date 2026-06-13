// Category meta — single source of truth for category pages, nav, filters.

export type CategoryKey =
  | "gadgets"
  | "eyewear"
  | "shoes"
  | "bags"
  | "watches"
  | "beauty"
  | "jewelry";

export type Subcategory = { slug: string; name_en: string; name_bn: string };

export const categories: Record<
  CategoryKey,
  {
    key: CategoryKey;
    slug: string;
    name_en: string;
    name_bn: string;
    blurb_en: string;
    blurb_bn: string;
    accent: string;
    cover: string;
    subs: Subcategory[];
  }
> = {
  gadgets: {
    key: "gadgets",
    slug: "gadgets",
    name_en: "Gadgets & electronics",
    name_bn: "গ্যাজেট ও ইলেকট্রনিকস",
    blurb_en: "TWS, MagSafe, cables, cases.",
    blurb_bn: "TWS, MagSafe, কেবল, কেস।",
    accent: "bg-cyan-500",
    cover: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "earbuds", name_en: "Earbuds & audio", name_bn: "ইয়ারবাড ও অডিও" },
      { slug: "charger", name_en: "Chargers", name_bn: "চার্জার" },
      { slug: "cable", name_en: "Cables", name_bn: "কেবল" },
      { slug: "case", name_en: "Phone cases", name_bn: "ফোন কেস" },
    ],
  },
  eyewear: {
    key: "eyewear",
    slug: "eyewear",
    name_en: "Eyewear & sunglasses",
    name_bn: "চশমা ও সানগ্লাস",
    blurb_en: "Polarized, blue-light, frames.",
    blurb_bn: "পোলারাইজড, ব্লু-লাইট, ফ্রেম।",
    accent: "bg-violet-500",
    cover: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "sunglasses", name_en: "Sunglasses", name_bn: "সানগ্লাস" },
      { slug: "blue-light", name_en: "Blue-light glasses", name_bn: "ব্লু-লাইট চশমা" },
      { slug: "frames", name_en: "Frames & lenses", name_bn: "ফ্রেম ও লেন্স" },
      { slug: "accessories", name_en: "Accessories", name_bn: "আনুষঙ্গিক" },
    ],
  },
  shoes: {
    key: "shoes",
    slug: "shoes",
    name_en: "Shoes & footwear",
    name_bn: "জুতা ও ফুটওয়্যার",
    blurb_en: "Sneakers, heels, sandals.",
    blurb_bn: "স্নিকার্স, হিল, স্যান্ডেল।",
    accent: "bg-emerald-500",
    cover: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "sneakers", name_en: "Sneakers", name_bn: "স্নিকার্স" },
      { slug: "heels", name_en: "Heels & pumps", name_bn: "হিল ও পাম্প" },
      { slug: "sandals", name_en: "Sandals & slides", name_bn: "স্যান্ডেল ও স্লাইড" },
      { slug: "boots", name_en: "Boots", name_bn: "বুট" },
    ],
  },
  bags: {
    key: "bags",
    slug: "bags",
    name_en: "Bags & luggage",
    name_bn: "ব্যাগ ও লাগেজ",
    blurb_en: "Handbags, crossbody, backpacks.",
    blurb_bn: "হ্যান্ডব্যাগ, ক্রসবডি, ব্যাকপ্যাক।",
    accent: "bg-amber-500",
    cover: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "handbag", name_en: "Handbags", name_bn: "হ্যান্ডব্যাগ" },
      { slug: "shoulder", name_en: "Shoulder bags", name_bn: "শোল্ডার ব্যাগ" },
      { slug: "crossbody", name_en: "Crossbody bags", name_bn: "ক্রসবডি ব্যাগ" },
      { slug: "backpack", name_en: "Backpacks", name_bn: "ব্যাকপ্যাক" },
    ],
  },
  watches: {
    key: "watches",
    slug: "watches",
    name_en: "Watches",
    name_bn: "ঘড়ি",
    blurb_en: "Smart, mechanical, fashion.",
    blurb_bn: "স্মার্ট, মেকানিক্যাল, ফ্যাশন।",
    accent: "bg-red-500",
    cover: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "smartwatch", name_en: "Smart watches", name_bn: "স্মার্ট ঘড়ি" },
      { slug: "mechanical", name_en: "Mechanical", name_bn: "মেকানিক্যাল" },
      { slug: "fashion", name_en: "Fashion & quartz", name_bn: "ফ্যাশন ও কোয়ার্টজ" },
      { slug: "sport", name_en: "Sport & dive", name_bn: "স্পোর্ট ও ডাইভ" },
    ],
  },
  beauty: {
    key: "beauty",
    slug: "beauty",
    name_en: "Beauty & care",
    name_bn: "সৌন্দর্য ও যত্ন",
    blurb_en: "Aloe mist, lash curlers.",
    blurb_bn: "অ্যালো মিস্ট, ল্যাশ কার্লার।",
    accent: "bg-cyan-400",
    cover: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "skincare", name_en: "Skincare", name_bn: "স্কিনকেয়ার" },
      { slug: "tools", name_en: "Beauty tools", name_bn: "বিউটি টুলস" },
      { slug: "haircare", name_en: "Hair care", name_bn: "হেয়ার কেয়ার" },
      { slug: "oem", name_en: "OEM / white label", name_bn: "OEM / হোয়াইট লেবেল" },
    ],
  },
  jewelry: {
    key: "jewelry",
    slug: "jewelry",
    name_en: "Jewelry",
    name_bn: "গয়না",
    blurb_en: "18K-plated, pearl studs.",
    blurb_bn: "18K-প্লেটেড, মুক্তা স্টাড।",
    accent: "bg-amber-400",
    cover: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=200&h=200&fit=crop&q=80",
    subs: [
      { slug: "bracelet", name_en: "Bracelets", name_bn: "ব্রেসলেট" },
      { slug: "earring", name_en: "Earrings", name_bn: "কানের দুল" },
      { slug: "necklace", name_en: "Necklaces", name_bn: "নেকলেস" },
      { slug: "ring", name_en: "Rings", name_bn: "রিং" },
    ],
  },
};

export const categoryList = Object.values(categories);
