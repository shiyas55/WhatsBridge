import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SandboxAdapter,
  MetaAdapter,
  SendSchema,
  metaBody,
  ProviderError,
} from "./adapters.js";
const input = SendSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  provider: "sandbox",
  phone: "+15551234567",
  kind: "text",
  payload: { body: "Hello" },
});
test("sandbox accepts deterministically without asserting real delivery", async () => {
  const result = await new SandboxAdapter().send(input);
  assert.equal(result.status, "accepted");
  assert.equal(result.simulated, true);
  assert.equal(result.provider_id, `sandbox_${input.id}`);
});
test("unofficial providers are not reachable through this gateway", () => {
  assert.equal(
    SendSchema.safeParse({ ...input, provider: "baileys" }).success,
    false,
  );
});
test("Meta payload includes callback correlation and recipient", () => {
  const body = metaBody(input);
  assert.equal(body.biz_opaque_callback_data, input.id);
  assert.equal(body.to, "15551234567");
});
test("Meta templates map language and components", () => {
  const body = metaBody({
    ...input,
    kind: "template",
    payload: { name: "verification", language: "en_US", components: [] },
  });
  assert.equal((body as any).template.language.code, "en_US");
});
test("Meta network failure is unknown, not safe to retry", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("timeout");
  };
  try {
    const result = await new MetaAdapter("v99.0").send({
      ...input,
      provider: "meta",
      phone_number_id: "123",
      credentials: { access_token: "test" },
    });
    assert.equal(result.status, "unknown");
  } finally {
    globalThis.fetch = original;
  }
});
test("Meta 429 is a bounded retryable rejection", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 429 });
  try {
    await assert.rejects(
      () =>
        new MetaAdapter("v99.0").send({
          ...input,
          phone_number_id: "123",
          credentials: { access_token: "test" },
        }),
      (e: unknown) => e instanceof ProviderError && e.safeToRetry,
    );
  } finally {
    globalThis.fetch = original;
  }
});
