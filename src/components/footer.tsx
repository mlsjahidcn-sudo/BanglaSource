"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t } = useLang();

  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-7xl px-6 md:px-10 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 22 22"
                fill="none"
                className="w-5 h-5 text-cyan-700"
                aria-hidden="true"
              >
                <path
                  d="M11 1.5L20.5 6.5V15.5L11 20.5L1.5 15.5V6.5L11 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 6.5L15.5 9V13L11 15.5L6.5 13V9L11 6.5Z"
                  fill="currentColor"
                />
              </svg>
              <span className="font-semibold tracking-tight text-[15px]">
                BanglaSource
              </span>
            </div>
            <p className="mt-3 text-sm text-fg-muted max-w-xs leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Sourcing */}
          <div>
            <h4 className="text-[12px] font-medium text-fg mb-3">
              {t("footer.sourcing")}
            </h4>
            <ul className="space-y-2 text-sm text-fg-muted">
              <li>
                <Link href="/categories" className="hover:text-fg">
                  Catalog
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-fg">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/shipping-rates" className="hover:text-fg">
                  Shipping rates
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-fg">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[12px] font-medium text-fg mb-3">
              {t("footer.company")}
            </h4>
            <ul className="space-y-2 text-sm text-fg-muted">
              <li>
                <Link href="/about" className="hover:text-fg">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-fg">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-fg">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/for-you" className="hover:text-fg">
                  For you
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[12px] font-medium text-fg mb-3">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-2 text-sm text-fg-muted">
              <li>
                <Link href="#" className="hover:text-fg">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-fg">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-fg">
                  {t("footer.refund")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[12px] text-fg-subtle">
          <p>{t("footer.copyright")}</p>
          <a
            href="mailto:hello@banglasource.com"
            className="hover:text-fg"
          >
            hello@banglasource.com
          </a>
        </div>
      </div>
    </footer>
  );
}
