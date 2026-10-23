import QRCode from "qrcode";
import { CheckCircle2 } from "lucide-react";
import { appUrl } from "@/lib/app-url";

/**
 * The customer's pickup credential: a QR code (opens the store's pickup
 * screen when scanned by staff) and a 6-digit PIN as a fallback.
 */
export async function PickupCode({ token, pin, collected }: { token: string; pin: string; collected: boolean }) {
  if (collected) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-600" aria-hidden />
        <p>
          <span className="font-bold">Collected.</span> This pickup code has been used and is no longer valid.
        </p>
      </div>
    );
  }
  const svg = await QRCode.toString(`${await appUrl()}/merchant/pickup?token=${token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="h-44 w-44 shrink-0 rounded-xl border border-gray-200 bg-white p-2"
        role="img"
        aria-label="Pickup QR code"
        // SVG generated on the server from our own token.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="text-center sm:text-left">
        <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">Pickup PIN</p>
        <p className="font-mono text-4xl font-black tracking-[0.3em] text-gray-900">{pin}</p>
        <p className="mt-2 text-sm text-gray-600">Show the QR code or tell staff this PIN at the pickup point. Don&apos;t share it before then.</p>
      </div>
    </div>
  );
}
