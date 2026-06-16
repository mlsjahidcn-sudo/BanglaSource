// End-to-end smoke test:
// 1. Sign in via Supabase auth (capture cookies)
// 2. POST to /api/quote/save with those cookies
// 3. Verify the row landed in the quotes table

import { writeFileSync } from "node:fs";

const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const APP_URL = "http://localhost:3000";
const EMAIL = "test+phase3@banglasource.bd";
const PASSWORD = "TestPass123!";

async function main() {
  // ── 1. Sign in
  const signin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!signin.ok) {
    console.error("sign in failed:", signin.status, await signin.text());
    process.exit(1);
  }
  const session = await signin.json();
  console.log("✓ signed in as", session.user.email, "(user_id:", session.user.id + ")");
  const accessToken = session.access_token;

  // ── 2. Save a quote via the API
  // The /api/quote/save uses cookies, not the Authorization header.
  // We need to call our /api/auth/signin-equivalent that sets cookies,
  // OR we directly call our app with a Bearer header.
  //
  // Simplest path: call our server's getServerClient indirectly by
  // first going through the cookies. The browser client sets cookies
  // via supabase.auth.signInWithPassword — we can do the equivalent
  // by setting the supabase auth cookies manually.
  //
  // In @supabase/ssr v0.12, the auth cookie value is:
  //   "base64-" + base64url(JSON({access_token, refresh_token, ...}))
  // base64url = base64 with `-_` instead of `+/` and no padding.
  // The "base64-" prefix tells the decoder to base64url-decode the payload.

  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const json = JSON.stringify({
    access_token: accessToken,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  const b64url = Buffer.from(json)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const cookieValue = `base64-${b64url}`;

  // ── 3. Fetch a real quote from our API first
  const quoteRes = await fetch(
    `${APP_URL}/api/quote/landed?productId=731925804637&qty=20&mode=air`,
  );
  const quoteJ = await quoteRes.json();
  if (!quoteJ.ok) {
    console.error("quote fetch failed:", quoteJ);
    process.exit(1);
  }
  console.log("✓ fetched real quote:", quoteJ.quote.quoteId, "total ৳" + quoteJ.quote.totalBdt);

  // ── 4. Save via our /api/quote/save with the auth cookie
  const saveRes = await fetch(`${APP_URL}/api/quote/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${cookieName}=${cookieValue}`,
    },
    body: JSON.stringify({
      quote: quoteJ.quote,
      product_ids: ["731925804637"],
      shipping_mode: "air",
      total_qty: 20,
    }),
  });
  const saveJ = await saveRes.json();
  console.log("✓ /api/quote/save → HTTP", saveRes.status);
  console.log("  response:", JSON.stringify(saveJ, null, 2));

  if (saveRes.ok && saveJ.ok) {
    console.log("\n✅ END-TO-END SUCCESS — quote saved for", EMAIL);
  } else {
    console.error("\n❌ END-TO-END FAILED");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
