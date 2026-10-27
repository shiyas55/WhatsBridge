import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { Send, Result, ProviderError } from "./adapters.js";

export type BaileysState = "idle" | "qr_ready" | "connecting" | "connected" | "disconnected" | "error";

export class BaileysService {
  private sock: WASocket | null = null;
  private state: BaileysState = "idle";
  private latestQr: string | null = null;
  private connectedPhone: string | null = null;
  private connectedName: string | null = null;
  private authDir: string;
  private isConnecting: boolean = false;
  private logger = pino({ level: "silent" });

  constructor(authDir?: string) {
    this.authDir = authDir || path.resolve(process.cwd(), "baileys_auth");
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  public async init(): Promise<void> {
    if (this.sock || this.isConnecting) {
      return;
    }
    this.isConnecting = true;
    this.state = "connecting";

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      const sock = makeWASocket({
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        browser: ["WhatsBridge (Test Demo)", "Chrome", "1.0.0"],
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.latestQr = await QRCode.toDataURL(qr);
            this.state = "qr_ready";
          } catch (err) {
            console.error("Failed to generate QR Data URL:", err);
            this.state = "error";
          }
        }

        if (connection === "close") {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`Baileys connection closed. Status code: ${statusCode}, Reconnect: ${shouldReconnect}`);

          this.sock = null;
          this.connectedPhone = null;
          this.connectedName = null;

          if (shouldReconnect) {
            this.state = "connecting";
            setTimeout(() => this.init(), 3000);
          } else {
            this.state = "disconnected";
            this.latestQr = null;
            // Clear auth files on logout
            try {
              if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
                fs.mkdirSync(this.authDir, { recursive: true });
              }
            } catch (e) {
              console.error("Error clearing auth directory:", e);
            }
          }
        } else if (connection === "open") {
          this.isConnecting = false;
          this.state = "connected";
          this.latestQr = null;
          const rawId = sock.user?.id || "";
          this.connectedPhone = rawId.split(":")[0].replace(/\D/g, "");
          this.connectedName = sock.user?.name || "Test Demo Official";
          console.log(`WhatsApp Multi-Device paired successfully! Connected phone: +${this.connectedPhone}`);
        }
      });
    } catch (error) {
      this.isConnecting = false;
      this.state = "error";
      console.error("Error initializing Baileys socket:", error);
    }
  }

  public getStatus() {
    return {
      status: this.state,
      qr: this.latestQr,
      phone: this.connectedPhone,
      name: this.connectedName,
      hasSession: fs.existsSync(path.join(this.authDir, "creds.json")),
    };
  }

  public async disconnect(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        console.warn("Error during logout:", err);
      }
      this.sock = null;
    }
    this.state = "disconnected";
    this.latestQr = null;
    this.connectedPhone = null;
    this.connectedName = null;
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (err) {
      console.error("Error removing auth dir on disconnect:", err);
    }
  }

  public async send(input: Send): Promise<Result> {
    if (this.state !== "connected" || !this.sock) {
      throw new ProviderError(503, true); // Safe to retry once connected
    }

    // WhatsApp JID: recipient phone number without '+' + '@s.whatsapp.net'
    const cleanNumber = input.phone.replace(/\D/g, "");
    const jid = `${cleanNumber}@s.whatsapp.net`;

    try {
      let sentMsg: any = undefined;

      if (input.kind === "text") {
        const text = String(input.payload.body || "");
        sentMsg = await this.sock.sendMessage(jid, { text });
      } else if (input.kind === "template") {
        // Formatter for template messages (e.g. Test Demo order alerts, OTPs, receipts)
        const templateName = String(input.payload.name || "Notification");
        const bodyText = formatTemplatePayload(input.payload);
        sentMsg = await this.sock.sendMessage(jid, { text: bodyText });
      } else if (input.kind === "image") {
        const link = String(input.payload.link || "");
        const caption = input.payload.caption ? String(input.payload.caption) : undefined;
        sentMsg = await this.sock.sendMessage(jid, {
          image: { url: link },
          caption,
        });
      } else if (input.kind === "document") {
        const link = String(input.payload.link || "");
        const filename = input.payload.filename ? String(input.payload.filename) : "document.pdf";
        const mimetype = input.payload.mimetype ? String(input.payload.mimetype) : "application/pdf";
        sentMsg = await this.sock.sendMessage(jid, {
          document: { url: link },
          mimetype,
          fileName: filename,
        });
      } else {
        // Fallback to text
        const text = JSON.stringify(input.payload);
        sentMsg = await this.sock.sendMessage(jid, { text });
      }

      const providerId = sentMsg?.key?.id || `baileys_${Date.now()}`;
      return {
        status: "accepted",
        provider_id: providerId,
        simulated: false,
      };
    } catch (err: any) {
      console.error("Failed to send message via Baileys:", err);
      throw new ProviderError(500, true);
    }
  }
}

/**
 * Format template message data into a rich WhatsApp formatted text message
 */
function formatTemplatePayload(payload: Record<string, unknown>): string {
  // Check if body was directly provided
  if (typeof payload.body === "string" && payload.body.trim()) {
    return payload.body;
  }

  const name = String(payload.name || "").toLowerCase();
  const components = Array.isArray(payload.components) ? payload.components : [];

  // Extract body parameters
  const bodyComponent = components.find((c: any) => c.type === "body");
  const params: string[] = (bodyComponent?.parameters || []).map((p: any) => String(p.text || ""));

  if (name.includes("test") || name.includes("demo") || name.includes("order")) {
    const customer = params[0] || "Valued Customer";
    const orderId = params[1] || `TD-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = params[2] || "Standard Test Suite (1x), API Sandbox Access (1x)";
    const total = params[3] || "$0.00";
    const status = params[4] || "Delivered ✅";

    return (
      `*🚀 TEST DEMO - NOTIFICATION UPDATE 🚀*\n\n` +
      `Hello *${customer}*,\n\n` +
      `Thank you for testing with *Test Demo*! Here is your latest notification status:\n\n` +
      `📦 *Reference ID:* #${orderId}\n` +
      `⚡ *Details:* ${items}\n` +
      `💰 *Total:* ${total}\n` +
      `🚀 *Status:* ${status}\n\n` +
      `_Need help? Reply directly to this WhatsApp message._`
    );
  }

  if (name.includes("otp") || name.includes("verify") || name.includes("auth")) {
    const code = params[0] || "948201";
    return (
      `*🔐 TEST DEMO - VERIFICATION CODE*\n\n` +
      `Your one-time login/confirmation code is:\n\n` +
      `👉 *${code}*\n\n` +
      `Valid for 5 minutes. Please do NOT share this code with anyone.`
    );
  }

  // Generic fallback with extracted params
  let text = `*${String(payload.name || "Notice").toUpperCase()}*\n\n`;
  if (params.length > 0) {
    params.forEach((val, idx) => {
      text += `• ${val}\n`;
    });
  } else {
    text += JSON.stringify(payload, null, 2);
  }
  return text;
}

export const baileysService = new BaileysService();
