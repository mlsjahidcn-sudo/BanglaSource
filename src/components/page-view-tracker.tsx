"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

let _sessionId: string | null = null;
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  if (_sessionId) return _sessionId;
  const key = "bs_sid";
  let sid = window.sessionStorage.getItem(key);
  if (!sid) {
    sid = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(key, sid);
  }
  _sessionId = sid;
  return sid;
}

export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Skip tracking on /api/*, /ops/*, /account
    if (!pathname) return;
    if (
      pathname.startsWith("/api") ||
      pathname.startsWith("/ops") ||
      pathname.startsWith("/account")
    ) {
      return;
    }
    const sid = getSessionId();
    // sendBeacon would be ideal but its payload type is limited; fetch with keepalive
    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        session_id: sid,
      }),
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  }, [pathname]);
  return null;
}
