import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { ChromeWrapper } from "./chrome-wrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
  metadataBase: new URL("https://banglasource.bd"),
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
      className={`${inter.variable} ${jetbrains.variable} ${notoBn.variable} h-full`}
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
        <LangProvider>
          <ChromeWrapper>{children}</ChromeWrapper>
        </LangProvider>
      </body>
    </html>
  );
}
