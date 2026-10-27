import express from "express";
import { timingSafeEqual, createHash } from "node:crypto";
import { createClient } from "redis";
import {
  SandboxAdapter,
  MetaAdapter,
  BaileysAdapter,
  SendSchema,
  ProviderError,
} from "./adapters.js";
import { baileysService } from "./baileys.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const token = process.env.GATEWAY_TOKEN;
if (!token || token.length < 24)
  throw new Error("GATEWAY_TOKEN must contain at least 24 characters");

// In-memory fallback if Redis is unavailable in local environment
interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { NX?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  ping(): Promise<string>;
}

class MemoryStore implements Store {
  private data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string, options?: { NX?: boolean }): Promise<boolean> {
    if (options?.NX && this.data.has(key)) return false;
    this.data.set(key, value);
    return true;
  }
  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
  async ping(): Promise<string> {
    return "PONG";
  }
}

let store: Store = new MemoryStore();
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    const redisClient = createClient({ url: redisUrl });
    redisClient.on("error", () => {
      // Quiet log in case of connection drop
    });
    await redisClient.connect();
    store = {
      get: async (k) => redisClient.get(k),
      set: async (k, v, opts) => {
        const res = await redisClient.set(k, v, opts?.NX ? { NX: true } : undefined);
        return Boolean(res);
      },
      del: async (k) => {
        await redisClient.del(k);
      },
      ping: async () => redisClient.ping(),
    };
    console.log(JSON.stringify({ event: "redis_connected" }));
  } catch (e) {
    console.warn("Redis unavailable, using fast in-memory store fallback");
  }
} else {
  console.log(JSON.stringify({ event: "using_in_memory_store" }));
}

// Auto-initialize Baileys if auth credentials exist or if requested
baileysService.init().catch((err) => {
  console.warn("Baileys initial background start:", err?.message || err);
});

app.get("/health", async (_req, res) => {
  try {
    await store.ping();
    res.json({
      status: "ok",
      baileys: baileysService.getStatus().status,
    });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

// Authentication middleware
app.use((req, res, next) => {
  const actual = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from("Bearer " + token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.sendStatus(401);
    return;
  }
  next();
});

// Baileys status endpoint (returns connection status, latest QR Data URL, connected phone)
app.get("/baileys/status", (_req, res) => {
  res.json(baileysService.getStatus());
});

// Trigger Baileys QR generation / reconnection
app.post("/baileys/connect", async (_req, res) => {
  await baileysService.init();
  res.json(baileysService.getStatus());
});

// Log out and disconnect Baileys session
app.post("/baileys/disconnect", async (_req, res) => {
  await baileysService.disconnect();
  res.json(baileysService.getStatus());
});

app.post("/validate", async (req, res) => {
  const { phone_number_id, access_token } = req.body;
  const version = process.env.META_GRAPH_VERSION ?? "";
  if (
    !/^\d+$/.test(phone_number_id ?? "") ||
    typeof access_token !== "string" ||
    !/^v\d+\.\d+$/.test(version)
  ) {
    res.sendStatus(400);
    return;
  }
  try {
    const result = await fetch(
      `https://graph.facebook.com/${version}/${phone_number_id}?fields=id,display_phone_number`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    res.status(result.ok ? 200 : 400).json({ valid: result.ok });
  } catch {
    res.sendStatus(503);
  }
});

app.post("/send", async (req, res) => {
  const parsed = SendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid send request", details: parsed.error });
    return;
  }
  const input = parsed.data;
  const key = "send:" + input.id;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        provider: input.provider,
        phone: input.phone,
        kind: input.kind,
        payload: input.payload,
        phone_number_id: input.phone_number_id,
      }),
    )
    .digest("hex");

  const claim = await store.set(
    key,
    JSON.stringify({ fingerprint, status: "unknown" }),
    { NX: true },
  );
  if (!claim) {
    const cached = JSON.parse((await store.get(key)) ?? "{}");
    if (cached.fingerprint !== fingerprint) {
      res.status(409).json({ error: "Idempotency conflict" });
      return;
    }
    res.status(cached.status === "unknown" ? 202 : 200).json(cached);
    return;
  }
  try {
    const adapter =
      input.provider === "sandbox"
        ? new SandboxAdapter()
        : input.provider === "baileys"
          ? new BaileysAdapter()
          : new MetaAdapter(process.env.META_GRAPH_VERSION ?? "");
    const result = await adapter.send(input);
    await store.set(key, JSON.stringify({ ...result, fingerprint }));
    res.status(result.status === "unknown" ? 202 : 200).json(result);
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.safeToRetry) await store.del(key);
      res
        .status(error.status)
        .json({
          error: error.message || "Provider rejected request",
          safe_to_retry: error.safeToRetry,
        });
    } else {
      res.status(202).json({ status: "unknown" });
    }
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(JSON.stringify({ event: "request_failed", error }));
    res
      .status(503)
      .json({ error: "Gateway unavailable", safe_to_retry: false });
  },
);

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "gateway_started", port: PORT }));
  
  // 10-Minute Keep-Alive Heartbeat to prevent Render & Database sleeping
  const pingUrl = process.env.KEEP_ALIVE_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/health` : undefined);
  if (pingUrl) {
    console.log(JSON.stringify({ event: "keep_alive_active", interval_minutes: 10, target: pingUrl }));
    setInterval(async () => {
      try {
        await fetch(pingUrl, { method: "GET" });
      } catch {}
    }, 10 * 60 * 1000);
  }
});
