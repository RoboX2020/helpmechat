var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
// worker.mjs
import privacy from "./fc9c9cb03fecf90629dbe233db41a38abe373646-privacy.html";
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (x) => x.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
var worker_default = { fetch(req, env) {
  if (req.method === "GET" && ["/privacy", "/"].includes(new URL(req.url).pathname)) return new Response(privacy, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
  return env.BUDGET.get(env.BUDGET.idFromName("global-helpmechat-budget")).fetch(req);
} };
var BudgetGateway = class {
  static {
    __name(this, "BudgetGateway");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS budget (month TEXT PRIMARY KEY, reserved INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS public_sessions (hash TEXT PRIMARY KEY, ip TEXT NOT NULL, expiry INTEGER NOT NULL, used INTEGER NOT NULL)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS ip_usage (ip TEXT NOT NULL, day TEXT NOT NULL, issued INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(ip,day))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS rates (token TEXT PRIMARY KEY, minute INTEGER NOT NULL, n INTEGER NOT NULL)");
  }
  async fetch(req) {
    const origin = req.headers.get("Origin") || "";
    const headers = { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Cache-Control": "no-store", "Content-Type": "application/json" };
    const reply = /* @__PURE__ */ __name((status, message) => new Response(JSON.stringify({ error: { message } }), { status, headers }), "reply");
    if (!(this.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean).includes(origin)) return new Response(null, { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "POST" } });
    if (this.env.ENABLE_API !== "true" || !this.env.OPENAI_API_KEY) return reply(503, "Service not enabled");
    const path = new URL(req.url).pathname;
    const ip = await hash((req.headers.get("CF-Connecting-IP") || "missing") + "|helpmechat-ip-v1");
    const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (path === "/v1/status" && req.method === "POST") {
      const reserved = [...this.sql.exec("SELECT COALESCE(SUM(reserved),0) AS total FROM budget")][0].total;
      return new Response(JSON.stringify({ version: "public-preview-v2", reservedCents: reserved, capCents: Math.min(400, Number(this.env.MAX_CENTS || 400)) }), { headers });
    }
    if (path === "/v1/session" && req.method === "POST") {
      const token2 = crypto.randomUUID() + crypto.randomUUID();
      const h2 = await hash(token2);
      const expiry = Date.now() + 30 * 864e5;
      const ok = this.ctx.storage.transactionSync(() => {
        this.sql.exec("DELETE FROM public_sessions WHERE expiry<?", Date.now());
        this.sql.exec("DELETE FROM ip_usage WHERE day<?", day);
        this.sql.exec("INSERT OR IGNORE INTO ip_usage VALUES (?,?,0,0)", ip, day);
        const row = [...this.sql.exec("SELECT issued FROM ip_usage WHERE ip=? AND day=?", ip, day)][0];
        if (row.issued >= 3) return false;
        this.sql.exec("UPDATE ip_usage SET issued=issued+1 WHERE ip=? AND day=?", ip, day);
        this.sql.exec("INSERT INTO public_sessions VALUES (?,?,?,0)", h2, ip, expiry);
        return true;
      });
      if (!ok) return reply(429, "Free preview signups used up for this network today. Try again tomorrow.");
      return new Response(JSON.stringify({ token: token2, expiresAt: expiry, allowance: 50 }), { headers });
    }
    if (path !== "/v1/generate" || req.method !== "POST") return reply(404, "Not found");
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (token.length < 32) return reply(401, "Start your free preview first");
    const h = await hash(token);
    const session = [...this.sql.exec("SELECT * FROM public_sessions WHERE hash=?", h)][0];
    if (!session || session.expiry <= Date.now()) return reply(401, "Your free preview session expired. Start again in settings.");
    const reader = req.body?.getReader();
    if (!reader) return reply(400, "Missing body");
    let bytes = 0, chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32e3) {
        await reader.cancel();
        return reply(413, "Context too large. Use a shorter chat export.");
      }
      chunks.push(value);
    }
    let input;
    try {
      let b = new Uint8Array(bytes), at = 0;
      for (const c of chunks) {
        b.set(c, at);
        at += c.length;
      }
      input = JSON.parse(new TextDecoder().decode(b));
    } catch {
      return reply(400, "Invalid request");
    }
    const system = input.systemInstruction?.parts?.map((p) => p.text).join("\n"), user = input.contents?.[0]?.parts?.map((p) => p.text).join("\n");
    if (typeof system !== "string" || typeof user !== "string" || input.contents?.length !== 1) return reply(400, "Invalid context");
    const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7), minute = Math.floor(Date.now() / 6e4);
    const outcome = this.ctx.storage.transactionSync(() => {
      const s = [...this.sql.exec("SELECT used FROM public_sessions WHERE hash=?", h)][0];
      if (s.used >= 50) return "Your free credits are used up. This preview includes 50 AI generations, including profile setup.";
      this.sql.exec("INSERT OR IGNORE INTO ip_usage VALUES (?,?,0,0)", ip, day);
      const network = [...this.sql.exec("SELECT used FROM ip_usage WHERE ip=? AND day=?", ip, day)][0];
      if (network.used >= 6) return "Free credits used up for this network today. Try again tomorrow.";
      const rate = [...this.sql.exec("SELECT minute,n FROM rates WHERE token=?", h)][0];
      let n = rate?.minute === minute ? rate.n + 1 : 1;
      if (n > 3) return "Please wait a minute before trying again.";
      const total = [...this.sql.exec("SELECT COALESCE(SUM(reserved),0) AS total FROM budget")][0].total;
      const limit = Math.min(400, Number(this.env.MAX_CENTS || 400));
      if (total + 5 > limit) return "Free credits are used up for this preview. The shared spending cap has been reached.";
      this.sql.exec("INSERT OR REPLACE INTO rates VALUES (?,?,?)", h, minute, n);
      this.sql.exec("INSERT OR IGNORE INTO budget VALUES (?,0)", month);
      this.sql.exec("UPDATE budget SET reserved=reserved+5 WHERE month=?", month);
      this.sql.exec("UPDATE public_sessions SET used=used+1 WHERE hash=?", h);
      this.sql.exec("UPDATE ip_usage SET used=used+1 WHERE ip=? AND day=?", ip, day);
      return "";
    });
    if (outcome) return reply(429, outcome);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${this.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4.1-mini-2025-04-14", messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, max_completion_tokens: 2048, temperature: 0.8, store: false }), signal: AbortSignal.timeout(45e3) });
      if (!r.ok) return reply(502, "AI request failed. The attempt counts toward free credits.");
      const data = await r.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string") return reply(502, "No reply generated");
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { headers });
    } catch {
      return reply(502, "AI request unavailable. The attempt counts toward free credits.");
    }
  }
};
export {
  BudgetGateway,
  worker_default as default
};
//# sourceMappingURL=worker.js.map
