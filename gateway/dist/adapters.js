import { z } from 'zod';
export const SendSchema = z.object({ id: z.uuid(), provider: z.enum(['sandbox', 'meta']), phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/), kind: z.enum(['text', 'image', 'document', 'video', 'audio', 'template']), payload: z.record(z.string(), z.unknown()), phone_number_id: z.string().default(''), credentials: z.object({ access_token: z.string().optional(), app_secret: z.string().optional(), verify_token: z.string().optional() }).default({}) });
export class ProviderError extends Error {
    status;
    safeToRetry;
    constructor(status, safeToRetry) {
        super('Provider request failed');
        this.status = status;
        this.safeToRetry = safeToRetry;
    }
}
export class SandboxAdapter {
    async send(input) { return { status: 'accepted', provider_id: `sandbox_${input.id}`, simulated: true }; }
}
export function metaBody(input) {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: input.phone.slice(1), type: input.kind, biz_opaque_callback_data: input.id };
    const p = input.payload;
    if (input.kind === 'text')
        return { ...base, text: { body: p.body, preview_url: false } };
    if (input.kind === 'template')
        return { ...base, template: { name: p.name, language: { code: p.language }, components: p.components ?? [] } };
    return { ...base, [input.kind]: { link: p.link, ...(p.caption && ['image', 'document', 'video'].includes(input.kind) ? { caption: p.caption } : {}), ...(input.kind === 'document' && p.filename ? { filename: p.filename } : {}) } };
}
export class MetaAdapter {
    version;
    constructor(version) {
        this.version = version;
        if (!/^v\d+\.\d+$/.test(version))
            throw new Error('Set META_GRAPH_VERSION to a supported Graph API version');
    }
    async send(input) {
        if (!input.credentials.access_token || !/^\d+$/.test(input.phone_number_id))
            throw new ProviderError(400, false);
        let response;
        try {
            response = await fetch(`https://graph.facebook.com/${this.version}/${input.phone_number_id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${input.credentials.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(metaBody(input)), signal: AbortSignal.timeout(20000) });
        }
        catch {
            return { status: 'unknown' };
        }
        if (response.status === 429)
            throw new ProviderError(429, true);
        // A 5xx response can be ambiguous; don't blindly resend.
        if (response.status >= 500)
            return { status: 'unknown' };
        if (!response.ok)
            throw new ProviderError(400, false);
        const data = await response.json();
        return data.messages?.[0]?.id ? { status: 'accepted', provider_id: data.messages[0].id } : { status: 'unknown' };
    }
}
