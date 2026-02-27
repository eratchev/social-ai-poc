// provider-anthropic.test.ts
//
// Bug 4: getCfg() called at module level captures env vars at import time.
// These tests verify that AnthropicProvider reads ANTHROPIC_MODEL at construct
// time (not at module-import time) so that env changes after import are respected.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the Anthropic SDK so the browser-environment check doesn't throw in jsdom.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

describe("AnthropicProvider — env vars read at construct/call time (Bug 4)", () => {
  const origModel = process.env.ANTHROPIC_MODEL;
  const origApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-dummy";
    delete process.env.ANTHROPIC_MODEL;
  });

  afterEach(() => {
    if (origModel === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = origModel;

    if (origApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = origApiKey;
  });

  it("modelName() reflects ANTHROPIC_MODEL set before construction", async () => {
    // Set the env var AFTER the module has already been imported once.
    // With the bug (module-level CFG/DEFAULT_MODEL), modelName() keeps
    // returning whatever was in the env at import time — not this new value.
    process.env.ANTHROPIC_MODEL = "claude-3-opus-20240229";

    const { AnthropicProvider } = await import("./provider-anthropic");
    const provider = new AnthropicProvider();

    expect(provider.modelName()).toBe("claude-3-opus-20240229");
  });

  it("modelName() falls back to 'claude-haiku-4-5' when ANTHROPIC_MODEL is unset", async () => {
    delete process.env.ANTHROPIC_MODEL;

    const { AnthropicProvider } = await import("./provider-anthropic");
    const provider = new AnthropicProvider();

    expect(provider.modelName()).toBe("claude-haiku-4-5");
  });

  it("two instances created with different ANTHROPIC_MODEL values return different modelName()", async () => {
    const { AnthropicProvider } = await import("./provider-anthropic");

    process.env.ANTHROPIC_MODEL = "model-alpha";
    const provider1 = new AnthropicProvider();

    process.env.ANTHROPIC_MODEL = "model-beta";
    const provider2 = new AnthropicProvider();

    // With the fix each constructor call reads getCfg() fresh.
    expect(provider1.modelName()).toBe("model-alpha");
    expect(provider2.modelName()).toBe("model-beta");
  });
});
