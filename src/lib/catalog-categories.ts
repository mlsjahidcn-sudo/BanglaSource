// Shared form constants for admin catalog pages.
//
// Phase 15c: extracted from the old /admin/import page so
// /admin/products/new can reuse the same category + label lists.

export const CATEGORIES: { value: string; label: string }[] = [
  { value: "gadgets", label: "Gadgets & electronics" },
  { value: "eyewear", label: "Eyewear (glasses / sunglasses)" },
  { value: "shoes", label: "Shoes" },
  { value: "bags", label: "Bags & wallets" },
  { value: "watches", label: "Watches" },
  { value: "beauty", label: "Beauty & personal care" },
];

export const ALLOWED_CATEGORIES = new Set(CATEGORIES.map((c) => c.value));
