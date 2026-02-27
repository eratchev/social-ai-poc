// provider-openai.test.ts
//
// Bug 4: getCfg() called at module level captures env vars at import time.
// These tests verify that OpenAIProvider reads OPENAI_MODEL at construct time
// (not at module-import time) so that env changes after import are respected.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the OpenAI SDK so the browser-environment check doesn't throw in jsdom.
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

describe("OpenAIProvider — env vars read at construct/call time (Bug 4)", () => {
  const origModel = process.env.OPENAI_MODEL;
  const origApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    if (origModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = origModel;

    if (origApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = origApiKey;
  });

  it("modelName() reflects OPENAI_MODEL set before construction", async () => {
    // Set the env var AFTER the module has already been imported once.
    // With the bug (module-level CFG/DEFAULT_MODEL), modelName() keeps
    // returning whatever was in the env at import time — not this new value.
    process.env.OPENAI_MODEL = "gpt-4-turbo";

    const { OpenAIProvider } = await import("./provider-openai");
    const provider = new OpenAIProvider();

    expect(provider.modelName()).toBe("gpt-4-turbo");
  });

  it("modelName() falls back to 'gpt-4o-mini' when OPENAI_MODEL is unset", async () => {
    delete process.env.OPENAI_MODEL;

    const { OpenAIProvider } = await import("./provider-openai");
    const provider = new OpenAIProvider();

    expect(provider.modelName()).toBe("gpt-4o-mini");
  });

  it("two instances created with different OPENAI_MODEL values return different modelName()", async () => {
    const { OpenAIProvider } = await import("./provider-openai");

    process.env.OPENAI_MODEL = "gpt-first";
    const provider1 = new OpenAIProvider();

    process.env.OPENAI_MODEL = "gpt-second";
    const provider2 = new OpenAIProvider();

    // With the fix each constructor call reads getCfg() fresh.
    expect(provider1.modelName()).toBe("gpt-first");
    expect(provider2.modelName()).toBe("gpt-second");
  });
});
