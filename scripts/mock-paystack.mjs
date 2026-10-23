// A local stand-in for Paystack's API and hosted checkout, for development
// and tests without real keys. It implements the endpoints Sub Net uses:
// transaction initialize/verify, refunds, and signed webhooks.
//
//   PAYSTACK_SECRET_KEY=sk_test_local node scripts/mock-paystack.mjs
//   # then run the app with PAYSTACK_BASE_URL=http://localhost:4010
//
// Env: MOCK_PAYSTACK_PORT (4010), APP_URL (http://localhost:3000) for webhooks.
import { createHmac } from "node:crypto";
import http from "node:http";

/** @param {{ port?: number, secret: string, webhookUrl?: string }} options */
export function startMockPaystack({ port = 4010, secret, webhookUrl }) {
  const transactions = new Map();
  const refunds = [];
  let txId = 1000;
  let refundId = 5000;
  const base = `http://localhost:${port}`;

  async function sendWebhook(event, data) {
    if (!webhookUrl) return;
    const body = JSON.stringify({ event, data });
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json", "x-paystack-signature": signature }, body }).catch(() => {});
  }

  function pay(ref, { webhook = true, channel = "card" } = {}) {
    const t = transactions.get(ref);
    if (!t) return null;
    if (t.status !== "success") Object.assign(t, { status: "success", paid_at: new Date().toISOString(), channel, gateway_response: "Successful" });
    if (webhook) void sendWebhook("charge.success", t);
    return t;
  }

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const authed = req.headers.authorization === `Bearer ${secret}`;
    const raw = req.method === "POST" ? await readBody(req) : "";
    const body = raw && req.headers["content-type"]?.includes("json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));

    if (req.method === "POST" && url.pathname === "/transaction/initialize") {
      if (!authed) return json(res, 401, { status: false, message: "Invalid key" });
      if (transactions.has(body.reference)) return json(res, 400, { status: false, message: "Duplicate Transaction Reference" });
      const t = { id: txId++, reference: body.reference, amount: Number(body.amount), currency: body.currency ?? "NGN", status: "ongoing", email: body.email, callback_url: body.callback_url, metadata: body.metadata };
      transactions.set(t.reference, t);
      return json(res, 200, { status: true, message: "Authorization URL created", data: { authorization_url: `${base}/checkout/${t.reference}`, access_code: "mock", reference: t.reference } });
    }
    const verify = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
    if (req.method === "GET" && verify) {
      if (!authed) return json(res, 401, { status: false, message: "Invalid key" });
      const t = transactions.get(decodeURIComponent(verify[1]));
      return t ? json(res, 200, { status: true, message: "Verification successful", data: t }) : json(res, 400, { status: false, message: "Transaction reference not found" });
    }
    if (req.method === "POST" && url.pathname === "/refund") {
      if (!authed) return json(res, 401, { status: false, message: "Invalid key" });
      const t = transactions.get(body.transaction);
      if (!t || t.status !== "success") return json(res, 400, { status: false, message: "Transaction not found or not successful" });
      const r = { id: refundId++, transaction_reference: t.reference, amount: Number(body.amount ?? t.amount), status: "pending" };
      refunds.push(r);
      setTimeout(() => {
        r.status = "processed";
        void sendWebhook("refund.processed", r);
      }, 200);
      return json(res, 200, { status: true, message: "Refund has been queued for processing", data: r });
    }
    // Hosted checkout page.
    const page = url.pathname.match(/^\/checkout\/([^/]+)$/);
    if (req.method === "GET" && page) {
      const t = transactions.get(decodeURIComponent(page[1]));
      if (!t) return json(res, 404, { status: false });
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Mock Paystack</title>
        <body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px">
        <h1>Mock Paystack checkout</h1><p>${t.email}</p><p style="font-size:28px"><b>NGN ${(t.amount / 100).toLocaleString()}</b></p>
        <form method=post action="/checkout/${t.reference}/pay"><button style="font-size:18px;padding:12px 24px">Pay</button></form>
        <form method=post action="/checkout/${t.reference}/cancel"><button>Cancel payment</button></form></body>`);
    }
    const action = url.pathname.match(/^\/checkout\/([^/]+)\/(pay|cancel)$/);
    if (req.method === "POST" && action) {
      const ref = decodeURIComponent(action[1]);
      const t = transactions.get(ref);
      if (!t) return json(res, 404, { status: false });
      if (action[2] === "pay") pay(ref);
      else t.status = "abandoned";
      res.writeHead(302, { location: `${t.callback_url}?trxref=${ref}&reference=${ref}` });
      return res.end();
    }
    // Test controls.
    const control = url.pathname.match(/^\/__control\/pay\/(.+)$/);
    if (req.method === "POST" && control) {
      const t = pay(decodeURIComponent(control[1]), { webhook: url.searchParams.get("webhook") !== "0" });
      return t ? json(res, 200, t) : json(res, 404, {});
    }
    if (url.pathname === "/__control/state") return json(res, 200, { transactions: [...transactions.values()], refunds });
    json(res, 404, { status: false, message: "Not found" });
  });

  return new Promise((resolve) => server.listen(port, () => resolve({ server, transactions, refunds, pay, close: () => new Promise((r) => server.close(r)) })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MOCK_PAYSTACK_PORT ?? 4010);
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "sk_test_local";
  const webhookUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/api/webhooks/paystack`;
  await startMockPaystack({ port, secret, webhookUrl });
  console.log(`Mock Paystack on http://localhost:${port} (webhooks → ${webhookUrl})`);
}
