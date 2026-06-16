"use client";
import { useLang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center text-[12px] font-medium tracking-wide border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2.5 h-8 transition-colors ${
          lang === "en"
            ? "bg-slate-900 text-white"
            : "text-fg-muted hover:bg-slate-50"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("bn")}
        aria-pressed={lang === "bn"}
        className={`px-2.5 h-8 transition-colors ${
          lang === "bn"
            ? "bg-slate-900 text-white"
            : "text-fg-muted hover:bg-slate-50"
        }`}
      >
        বাং
      </button>
    </div>
  );
}
