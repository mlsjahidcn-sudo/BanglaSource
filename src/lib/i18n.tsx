"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { dict, type Lang } from "./i18n-dict";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
};

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("bs-lang") as Lang | null;
    if (saved === "en" || saved === "bn") {
      setLangState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bs-lang", l);
      document.documentElement.lang = l;
    }
  }, []);

  const tFn = useCallback(
    (key: string, replacements?: Record<string, string | number>) => {
      const raw = dict[key]?.[lang] ?? dict[key]?.en ?? key;
      if (!replacements) return raw;
      return Object.entries(replacements).reduce(
        (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
        raw,
      );
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t: tFn }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang must be used inside LangProvider");
  return v;
}
