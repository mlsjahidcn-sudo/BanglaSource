// /lib/contact.ts
//
// Phase 24: single source of truth for the brand's
// contact surface (phone, email, WhatsApp, address,
// hours). Phase 24 found these were inconsistent
// across files — some pages showed a BD number
// (+8801732...), some a CN desk number (+861732...).
// Both are real, but for customer-facing "Talk to
// us on WhatsApp" we standardize on the China desk
// because:
//   - The catalog is sourced from China; the
//     conversation that starts on WhatsApp is
//     almost always about a specific product
//     ("can you ship 200 of these by mid-July?")
//   - The CN desk is staffed 24/7 (the BD office
//     is Sat-Thu 9-18 BST)
//   - The same number already appears in every
//     transactional email (the `lib/email.ts`
//     notifyOrderPlaced email), so the buyer
//     recognizes it
//
// If you ever swap to a BD-only desk, change
// `WHATSAPP_E164` here and every page picks it up.

export const BRAND = {
  name: "BanglaSource",
  domain: "banglasource.com",
  email: "hello@banglasource.com",
  /** Bangladesh BD mobile. Display only; the clickable
   *  link uses the E.164 form `+88` prefix. */
  phoneBdDisplay: "09613-828606",
  phoneBdE164: "+8809613828606",
  /** WhatsApp — China desk. E.164 with `+` sign.
   *  Use `wa.me/${WHATSAPP_E164_PLUSLESS}` for the
   *  universal deep link (no +). */
  whatsappE164: "+8617325764171",
  whatsappE164Plusless: "8617325764171",
  whatsappDisplay: "+86 173 2576 4171",
  address: [
    "A.N.Z. Square, 6th Floor (Lift-6)",
    "Zigatola Bus Stand, Satmasjid Road",
    "Dhaka 1205, Bangladesh",
  ],
  hours: "Sat–Thu 9:00–18:00 BST (Dhaka)",
  hoursCn: "Mon–Sun 09:00–21:00 CST (China desk)",
} as const;

/** Universal WhatsApp deep link. */
export function whatsappLink(prefillMessage?: string): string {
  const base = `https://wa.me/${BRAND.whatsappE164Plusless}`;
  if (!prefillMessage) return base;
  return `${base}?text=${encodeURIComponent(prefillMessage)}`;
}

/** Pre-fill a WhatsApp message that mentions a
 *  specific product. Use on PDP / cart drawer. The
 *  message is intentionally short and references
 *  the product so the China desk can pull it up. */
export function whatsappProductMessage(
  productTitle: string,
  sourceId: string,
  siteUrl: string,
): string {
  return `Hi BanglaSource, I'm interested in ${productTitle} (ref ${sourceId}). Can you share landed cost to Dhaka for 100 pcs? ${siteUrl}/products/${sourceId}`;
}
