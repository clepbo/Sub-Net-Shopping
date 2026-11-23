// A local stand-in for Monnify's API, for development and tests without real
// keys. It covers what SubNet uses: login, init-transaction and query, hosted
// checkout, refunds, reserved (virtual) accounts, single disbursements and
// signed webhooks.
//
//   node scripts/mock-monnify.mjs
//   # then run the app with MONNIFY_BASE_URL=http://localhost:4020
//   #   MONNIFY_API_KEY=MK_TEST MONNIFY_SECRET_KEY=mock-secret MONNIFY_CONTRACT_CODE=1234567890
//   #   MONNIFY_WALLET_ACCOUNT_NUMBER=9999999999 (for payouts)
//
// Env: MOCK_MONNIFY_PORT (4020), MONNIFY_SECRET_KEY, APP_URL for webhooks.
import { createHmac } from "node:crypto";
import http from "node:http";

/** @param {{ port?: number, apiKey?: string, secret: string, webhookUrl?: string }} options */
export function startMockMonnify({ port = 4020, apiKey = "MK_TEST", secret, webhookUrl }) {
  const base = `http://localhost:${port}`;
  const token = "mock-access-token";
  const transactions = new Map(); // by paymentReference
  const byTxRef = new Map();
  const refunds = [];
  const accounts = new Map(); // accountReference → account
  const disbursements = [];
  let seq = 1;

  const ok = (res, body) => json(res, 200, { requestSuccessful: true, responseMessage: "success", responseCode: "0", responseBody: body });
  const fail = (res, status, message) => json(res, status, { requestSuccessful: false, responseMessage: message, responseCode: "99" });
  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });

  async function sendWebhook(eventType, eventData) {
    if (!webhookUrl) return;
    const body = JSON.stringify({ eventType, eventData });
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json", "monnify-signature": signature }, body }).catch(() => {});
  }

  function pay(paymentReference, { webhook = true } = {}) {
    const t = transactions.get(paymentReference);
    if (!t) return null;
    if (t.paymentStatus !== "PAID") Object.assign(t, { paymentStatus: "PAID", amountPaid: t.totalPayable, paidOn: new Date().toISOString(), paymentMethod: "CARD" });
    if (webhook) void sendWebhook("SUCCESSFUL_TRANSACTION", t);
    return t;
  }

  /** Simulates a bank transfer into a reserved account (rider remittance). */
  function transferIn(accountReference, amountNaira, { webhook = true } = {}) {
    const acct = accounts.get(accountReference);
    if (!acct) return null;
    const t = {
      transactionReference: `MNFY|${Date.now()}|${seq++}`,
      paymentReference: `MNFY|RA|${seq++}`,
      amountPaid: amountNaira,
      totalPayable: amountNaira,
      paymentStatus: "PAID",
      paymentMethod: "ACCOUNT_TRANSFER",
      currency: "NGN",
      paidOn: new Date().toISOString(),
      product: { type: "RESERVED_ACCOUNT", reference: accountReference },
    };
    byTxRef.set(t.transactionReference, t);
    if (webhook) void sendWebhook("SUCCESSFUL_TRANSACTION", t);
    return t;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const raw = req.method === "POST" ? await readBody(req) : "";
    const body = raw ? JSON.parse(raw) : {};
    const bearer = req.headers.authorization === `Bearer ${token}`;

    if (req.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const expected = `Basic ${Buffer.from(`${apiKey}:${secret}`).toString("base64")}`;
      if (req.headers.authorization !== expected) return fail(res, 401, "Invalid credentials");
      return ok(res, { accessToken: token, expiresIn: 3600 });
    }
    if (url.pathname.startsWith("/api/") && !bearer && !url.pathname.startsWith("/api/v1/auth")) return fail(res, 401, "Unauthorized");

    if (req.method === "POST" && url.pathname === "/api/v1/merchant/transactions/init-transaction") {
      if (transactions.has(body.paymentReference)) return fail(res, 400, "Duplicate payment reference");
      const t = {
        transactionReference: `MNFY|${Date.now()}|${seq++}`,
        paymentReference: body.paymentReference,
        totalPayable: body.amount,
        amountPaid: 0,
        paymentStatus: "PENDING",
        currency: body.currencyCode ?? "NGN",
        customerEmail: body.customerEmail,
        redirectUrl: body.redirectUrl,
        product: { type: "WEB_SDK", reference: body.paymentReference },
      };
      transactions.set(t.paymentReference, t);
      byTxRef.set(t.transactionReference, t);
      return ok(res, { transactionReference: t.transactionReference, paymentReference: t.paymentReference, checkoutUrl: `${base}/checkout/${encodeURIComponent(t.paymentReference)}` });
    }
    if (req.method === "GET" && url.pathname === "/api/v2/merchant/transactions/query") {
      const t = transactions.get(url.searchParams.get("paymentReference") ?? "");
      return t ? ok(res, t) : fail(res, 404, "Transaction not found");
    }
    const getTx = url.pathname.match(/^\/api\/v2\/transactions\/(.+)$/);
    if (req.method === "GET" && getTx) {
      const t = byTxRef.get(decodeURIComponent(getTx[1]));
      return t ? ok(res, t) : fail(res, 404, "Transaction not found");
    }
    if (req.method === "POST" && url.pathname === "/api/v1/refunds/initiate-refund") {
      const t = byTxRef.get(body.transactionReference);
      if (!t || t.paymentStatus !== "PAID") return fail(res, 400, "Transaction not refundable");
      const r = { refundReference: body.refundReference, transactionReference: t.transactionReference, refundAmount: body.refundAmount, refundStatus: "IN_PROGRESS" };
      refunds.push(r);
      setTimeout(() => {
        r.refundStatus = "COMPLETED";
        void sendWebhook("SUCCESSFUL_REFUND", r);
      }, 200);
      return ok(res, r);
    }
    if (req.method === "POST" && url.pathname === "/api/v2/bank-transfer/reserved-accounts") {
      if (accounts.has(body.accountReference)) return fail(res, 400, "Account reference already in use");
      const acct = {
        accountReference: body.accountReference,
        accountName: body.accountName,
        customerEmail: body.customerEmail,
        accounts: [{ bankName: "Moniepoint Microfinance Bank", bankCode: "50515", accountNumber: String(5000000000 + accounts.size + 1), accountName: body.accountName }],
      };
      accounts.set(acct.accountReference, acct);
      return ok(res, acct);
    }
    if (req.method === "POST" && url.pathname === "/api/v2/disbursements/single") {
      if (disbursements.some((d) => d.reference === body.reference)) return fail(res, 400, "Duplicate reference");
      const failed = body.destinationAccountNumber === "0000000000";
      const d = { reference: body.reference, amount: body.amount, destinationAccountNumber: body.destinationAccountNumber, destinationBankCode: body.destinationBankCode, sourceAccountNumber: body.sourceAccountNumber, status: failed ? "FAILED" : "SUCCESS" };
      disbursements.push(d);
      return ok(res, d);
    }
    if (req.method === "GET" && url.pathname === "/api/v1/disbursements/account/validate") {
      return ok(res, { accountNumber: url.searchParams.get("accountNumber"), accountName: "MOCK ACCOUNT HOLDER", bankCode: url.searchParams.get("bankCode") });
    }
    // Hosted checkout.
    const page = url.pathname.match(/^\/checkout\/([^/]+)$/);
    if (req.method === "GET" && page) {
      const t = transactions.get(decodeURIComponent(page[1]));
      if (!t) return json(res, 404, {});
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Mock Monnify</title>
        <body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px">
        <h1>Mock Monnify checkout</h1><p>${t.customerEmail}</p><p style="font-size:28px"><b>NGN ${Number(t.totalPayable).toLocaleString()}</b></p>
        <form method=post action="/checkout/${encodeURIComponent(t.paymentReference)}/pay"><button style="font-size:18px;padding:12px 24px">Pay</button></form></body>`);
    }
    const action = url.pathname.match(/^\/checkout\/([^/]+)\/pay$/);
    if (req.method === "POST" && action) {
      const ref = decodeURIComponent(action[1]);
      const t = pay(ref);
      if (!t) return json(res, 404, {});
      res.writeHead(302, { location: `${t.redirectUrl}?paymentReference=${encodeURIComponent(ref)}` });
      return res.end();
    }
    // Test controls.
    const control = url.pathname.match(/^\/__control\/pay\/(.+)$/);
    if (req.method === "POST" && control) {
      const t = pay(decodeURIComponent(control[1]), { webhook: url.searchParams.get("webhook") !== "0" });
      return t ? json(res, 200, t) : json(res, 404, {});
    }
    const tin = url.pathname.match(/^\/__control\/transfer-in\/(.+)$/);
    if (req.method === "POST" && tin) {
      const t = transferIn(decodeURIComponent(tin[1]), Number(url.searchParams.get("amount")), { webhook: url.searchParams.get("webhook") !== "0" });
      return t ? json(res, 200, t) : json(res, 404, {});
    }
    if (url.pathname === "/__control/state") return json(res, 200, { transactions: [...transactions.values()], refunds, accounts: [...accounts.values()], disbursements });
    fail(res, 404, "Not found");
  });

  return new Promise((resolve) =>
    server.listen(port, () => resolve({ server, transactions, refunds, accounts, disbursements, pay, transferIn, close: () => new Promise((r) => server.close(r)) })),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MOCK_MONNIFY_PORT ?? 4020);
  const secret = process.env.MONNIFY_SECRET_KEY ?? "mock-secret";
  const webhookUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/api/webhooks/monnify`;
  await startMockMonnify({ port, secret, apiKey: process.env.MONNIFY_API_KEY ?? "MK_TEST", webhookUrl });
  console.log(`Mock Monnify on http://localhost:${port} (webhooks → ${webhookUrl})`);
}
