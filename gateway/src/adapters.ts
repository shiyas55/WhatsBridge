import { z } from "zod";
export const SendSchema = z.object({
  id: z.uuid(),
  provider: z.enum(["sandbox", "meta", "baileys"]),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  kind: z.enum(["text", "image", "document", "video", "audio", "template"]),
  payload: z.record(z.string(), z.unknown()),
  phone_number_id: z.string().default(""),
  credentials: z
    .object({
      access_token: z.string().optional(),
      app_secret: z.string().optional(),
      verify_token: z.string().optional(),
    })
    .default({}),
});
export type Send = z.infer<typeof SendSchema>;
export type Result = {
  status: "accepted" | "unknown";
  provider_id?: string;
  simulated?: boolean;
};
export class ProviderError extends Error {
  constructor(
    public status: number,
    public safeToRetry: boolean,
  ) {
    super("Provider request failed");
  }
}
export interface Adapter {
  send(input: Send): Promise<Result>;
}
export class SandboxAdapter implements Adapter {
  async send(input: Send): Promise<Result> {
    return {
      status: "accepted",
      provider_id: `sandbox_${input.id}`,
      simulated: true,
    };
  }
}
export class BaileysAdapter implements Adapter {
  async send(input: Send): Promise<Result> {
    const { baileysService } = await import("./baileys.js");
    return baileysService.send(input);
  }
}
export function metaBody(input: Send) {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.phone.slice(1),
    type: input.kind,
    biz_opaque_callback_data: input.id,
  };
  const p = input.payload;
  if (input.kind === "text")
    return { ...base, text: { body: p.body, preview_url: false } };
  if (input.kind === "template")
    return {
      ...base,
      template: {
        name: p.name,
        language: { code: p.language },
        components: p.components ?? [],
      },
    };
  return {
    ...base,
    [input.kind]: {
      link: p.link,
      ...(p.caption && ["image", "document", "video"].includes(input.kind)
        ? { caption: p.caption }
        : {}),
      ...(input.kind === "document" && p.filename
        ? { filename: p.filename }
        : {}),
    },
  };
}
export class MetaAdapter implements Adapter {
  constructor(private version: string) {
    if (!/^v\d+\.\d+$/.test(version))
      throw new Error(
        "Set META_GRAPH_VERSION to a supported Graph API version",
      );
  }
  async send(input: Send): Promise<Result> {
    if (!input.credentials.access_token || !/^\d+$/.test(input.phone_number_id))
      throw new ProviderError(400, false);
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${this.version}/${input.phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.credentials.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaBody(input)),
          signal: AbortSignal.timeout(20000),
        },
      );
    } catch {
      return { status: "unknown" };
    }
    if (response.status === 429) throw new ProviderError(429, true);
    // A 5xx response can be ambiguous; don't blindly resend.
    if (response.status >= 500) return { status: "unknown" };
    if (!response.ok) throw new ProviderError(400, false);
    const data = (await response.json()) as { messages?: { id: string }[] };
    return data.messages?.[0]?.id
      ? { status: "accepted", provider_id: data.messages[0].id }
      : { status: "unknown" };
  }
}
