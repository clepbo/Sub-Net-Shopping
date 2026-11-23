import "server-only";

export type Email = { to: string; subject: string; text: string; html?: string };

/** True when outgoing email is configured (RESEND_API_KEY). */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends an email through Resend's HTTP API. Without RESEND_API_KEY (local
 * development) the message is printed to the server log instead.
 */
export async function sendEmail(msg: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "SubNet Shopping <onboarding@resend.dev>";
  if (!key) {
    console.info(`[email:dev] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return true;
  }
  try {
    const res = await fetch(`${process.env.RESEND_BASE_URL ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text().catch(() => "")}`);
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A plain branded email body with one button. */
export function emailLayout({ heading, paragraphs, button }: { heading: string; paragraphs: string[]; button?: { label: string; url: string } }) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden">
<div style="background:#014b4e;color:#fff;padding:20px 24px;font-weight:800;font-size:18px">SubNet <span style="color:#ffc507">Shopping</span></div>
<div style="padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("")}
${button ? `<p style="margin:20px 0"><a href="${esc(button.url)}" style="background:#014b4e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${esc(button.label)}</a></p><p style="font-size:12px;color:#6b7280;word-break:break-all">Or open this link: ${esc(button.url)}</p>` : ""}
</div></div></body></html>`;
}
