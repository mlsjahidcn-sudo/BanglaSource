"use client";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";

// Phase 24 bugfix: the previous version only scheduled
// the auto-hide timeout INSIDE the "freshly added" if-
// block. When the user added the SAME product twice in
// a row, the second render's effect would skip the
// if-block, the cleanup of the FIRST effect's timeout
// would fire (because the effect was re-running), and
// the toast would stay visible forever. The fix:
// split the single effect into two — one for detection
// (sets `show=true` on a freshly added product), one
// for the auto-hide timeout keyed only on `show`. The
// hide effect's cleanup cancels any pending timer
// whenever `show` flips off, so unrelated cart changes
// (qty bumps, removes) don't strand the toast in the
// "on" state.
const TOAST_TTL_MS = 2200;

export function CartToast() {
  const { t } = useLang();
  const { items } = useCart();
  const [show, setShow] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const [lastId, setLastId] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Detection: when a NEW product enters the cart (or
  // qty grows for a different product), flip `show` to
  // true. We track the last seen (count, id) pair so that
  // qty bumps on the SAME product don't re-trigger the
  // toast.
  useEffect(() => {
    const total = items.reduce((s, i) => s + i.qty, 0);
    const newest = items.at(-1);
    if (newest && total > lastCount && newest.productId !== lastId) {
      setLastCount(total);
      setLastId(newest.productId);
      setShow(true);
    } else {
      setLastCount(total);
    }
  }, [items, lastCount, lastId]);

  // 2) Auto-hide: schedule the hide timer on every render
  // where `show` is true. Cleanup cancels any pending
  // timer whenever `show` flips off (or this effect
  // re-runs while still on, which is fine — we reschedule
  // a fresh 2.2s window, exactly what we want).
  useEffect(() => {
    if (!show) return;
    hideTimerRef.current = setTimeout(() => setShow(false), TOAST_TTL_MS);
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-2xl text-[13px] flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {t("cart.added")}
    </div>
  );
}
