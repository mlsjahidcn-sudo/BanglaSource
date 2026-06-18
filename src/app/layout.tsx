import type { Metadata } from "next";
import { Ubuntu, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { ChromeWrapper } from "./chrome-wrapper";

// Ubuntu is a humanist sans-serif designed for the Ubuntu OS.
// It reads warmly and slightly rounded — fits a B2B sourcing site
// that wants to feel local, not corporate. We pull the 3 weights
// we actually use: 400 (body), 500 (semibold-like emphasis), 700
// (display headings). 600 isn't in the Ubuntu family; Tailwind's
// `font-semibold` will fall back to 500.
const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const notoBn = Noto_Sans_Bengali({
  variable: "--font-noto-bn",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://banglasource.com"),
  title: {
    default: "BanglaSource — Bulk Wholesale Sourcing, Made Simple",
    template: "%s · BanglaSource",
  },
  description:
    "Bulk wholesale, made simple. Verified factories, one all-in BDT price, bKash & bank payment, consolidated air/sea shipping.",
  openGraph: {
    title: "BanglaSource — Bulk Wholesale Sourcing, Made Simple",
    description:
      "Bulk wholesale from verified factories. One all-in BDT price, bKash payment, end-to-end shipping.",
    locale: "en_BD",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${ubuntu.variable} ${jetbrains.variable} ${notoBn.variable} h-full`}
    >
      <body
        className="min-h-full flex flex-col bg-bg text-fg"
        // Browser extensions (Grammarly, Honey, etc.) inject
        // data-* attributes on <body> before React hydrates.
        // suppressHydrationWarning tells React to ignore the
        // mismatch on this single element — the attributes are
        // added by the extension, not by our app, so there's
        // nothing for the server to predict.
        suppressHydrationWarning
      >
        {/*
          Phase 25: skip-to-content link. The first focusable
          element on the page. Hidden by default via the
          `sr-only` Tailwind class; becomes visible on focus
          (the `:focus-visible` global in globals.css styles
          it). Tab-key users land on this and Enter skips
          past the nav straight to <main>.

          We link to `#main-content` — the target is rendered
          by the portal shell (admin/buyer) or the public
          wrapper (root).
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-cyan-600 focus:text-white focus:text-[13px] focus:font-medium focus:shadow-lg"
        >
          Skip to content
        </a>
        <LangProvider>
          <ChromeWrapper>{children}</ChromeWrapper>
        </LangProvider>
      </body>
    </html>
  );
}
