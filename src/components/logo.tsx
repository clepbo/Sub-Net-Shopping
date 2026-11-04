/* eslint-disable @next/next/no-img-element -- small static brand images; no optimisation needed */
import { cx } from "./ui";

/** The rounded app icon (teal square with the cart and S). */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/brand/logo-mark.png" alt="" width={256} height={256} className={cx("shrink-0 rounded-[22%]", className)} />;
}

/** The full "SubNet Shopping" wordmark, for light backgrounds. */
export function Wordmark({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src="/brand/logo-wordmark.png" alt="Sub Net Shopping" width={453} height={160} className={cx("shrink-0", className)} />;
}
