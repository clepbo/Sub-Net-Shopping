"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { buttonClass, cx } from "./ui";

type Status = "checking" | "unsupported" | "ios-install" | "blocked" | "off" | "on" | "working";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Lets a customer, store or rider get notifications on this phone or computer. */
export function PushToggle({ publicKey, className }: { publicKey: string | null; className?: string }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      let next: Status;
      if (!publicKey) next = "unsupported";
      else if (!supported) next = ios && !standalone ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        next = (await reg?.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "blocked" : "off");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey!) });
      await savePushSubscription(sub.toJSON());
      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("working");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("off");
  }

  if (status === "checking" || status === "unsupported") return null;
  if (status === "ios-install") {
    return <p className={cx("text-xs text-gray-600", className)}>To get reminders on iPhone, tap Share → “Add to Home Screen”, then open Sub Net from your home screen.</p>;
  }
  if (status === "blocked") {
    return <p className={cx("text-xs text-gray-600", className)}>Notifications are blocked for this site. Allow them in your browser settings to get reminders.</p>;
  }
  return status === "on" ? (
    <button type="button" onClick={disable} className={cx(buttonClass("ghost", "sm"), className)}>
      <BellOff className="h-4 w-4" aria-hidden /> Turn off phone notifications
    </button>
  ) : (
    <button type="button" onClick={enable} disabled={status === "working"} className={cx(buttonClass("secondary", "sm"), className)}>
      <BellRing className="h-4 w-4" aria-hidden /> {status === "working" ? "Turning on…" : "Get reminders on this phone"}
    </button>
  );
}
