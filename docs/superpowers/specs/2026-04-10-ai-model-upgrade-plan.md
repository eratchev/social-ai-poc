# AI Model Upgrade Plan

**Date:** 2026-04-10  
**Status:** gpt-4.1 family in production; GPT-5 deferred pending infrastructure upgrade

---

## Current Production Models

| Role | Model | Notes |
|---|---|---|
| Fast / Balanced / Captions / Vision | `gpt-4.1-mini` | Non-reasoning, fast (~5–10s per call) |
| Premium | `gpt-4.1` | Non-reasoning, fast (~5–15s per call) |
| Comicify image | `gpt-image-1.5` | Replaces deprecated dall-e-3 |
| Anthropic fast | `claude-haiku-4-5-20251001` | |
| Anthropic balanced | `claude-sonnet-4-6` | |
| Anthropic premium | `claude-opus-4-6` | |

All models are overridable via env vars (`OPENAI_MODEL_FAST`, `OPENAI_MODEL_BALANCED`, `OPENAI_MODEL_PREMIUM`, `OPENAI_VISION_MODEL`, `OPENAI_IMAGE_MODEL`) without code changes.

---

## What Was Attempted: GPT-5 Upgrade

### Target models
- `gpt-5-mini` (fast / balanced / captions / vision)
- `gpt-5` (premium)
- `gpt-image-1.5` (image generation — kept)

### Issues encountered

**1. `temperature` not supported**  
GPT-5 and gpt-5-mini are reasoning models (like o1/o3). They reject any `temperature` value other than the default (1), returning a 400 error. Every story generation failed immediately.  
→ Fixed by `supportsTemperature()` guard in provider-openai.ts and captions-openai.ts.

**2. `max_tokens` not supported**  
Reasoning models require `max_completion_tokens` instead of the legacy `max_tokens` parameter.  
→ Fixed across all OpenAI chat calls.

**3. Reasoning token budget exhaustion**  
Reasoning models spend hidden "thinking" tokens before producing output. With `max_completion_tokens: 1200`, the entire budget was consumed by reasoning — leaving `content: ""`. Raised to 16 000, but this made calls significantly slower.

**4. Vercel Hobby 60s function timeout**  
The full pipeline (captions + beats + panels + narrative) with GPT-5 takes ~2–4 minutes. Vercel Hobby caps all functions at 60 seconds. The function was killed mid-flight before it could write `ERROR` to the database, leaving stories stuck as `PROCESSING`.  
→ Reverted to gpt-4.1 family. Stories now complete in ~15–30s total.

---

## Upgrade Path to GPT-5

To successfully run GPT-5 in production, **all three of the following are required**:

### Prerequisite 1 — Vercel Pro (or equivalent)
Vercel Pro allows up to 300s for Node.js functions. The run route already has `maxDuration = 300` set and ready.  
**Cost:** ~$20/month.

### Prerequisite 2 — Background job architecture (recommended)
Even on Pro, a 4-minute synchronous function is brittle. The proper solution is to move story generation to a background job service so each phase (beats → panels → narrative) runs as a separate step within the timeout budget.

**Recommended: Inngest**
- Native Next.js integration
- Free tier: 100k function-runs/month
- Each phase = one step (each within 60s even on Hobby)
- Automatic retries on failure
- DB updated between steps — existing client polling just works

**Effort:** ~1–2 days to implement. See background job design (planned).

### Prerequisite 3 — Cost awareness
GPT-5 reasoning models consume significantly more tokens per call than gpt-4.1. A single story generation (3 phases + captions) may use 20k–60k tokens vs ~3k–8k for gpt-4.1. Monitor costs before enabling for all users.

---

## Options Comparison

| Option | Quality | Speed | Cost | Infrastructure | Recommended? |
|---|---|---|---|---|---|
| **gpt-4.1-mini (current)** | Good | Fast (~15s total) | Low | None (works on Hobby) | ✓ Now |
| **gpt-4.1 premium** | Better | Fast (~20s total) | Medium | None (works on Hobby) | ✓ Now (premium tier) |
| **GPT-5 via env override** | Best | Slow (~2–4 min) | High | Vercel Pro required | ✓ When on Pro |
| **GPT-5 + Inngest** | Best | Slow but non-blocking | High | Vercel Pro + Inngest | ✓ Long-term |

---

## Decision Log

| Decision | Rationale |
|---|---|
| Revert to gpt-4.1 family | GPT-5 is a reasoning model incompatible with Hobby's 60s limit |
| Keep `supportsTemperature()` guard | Allows future GPT-5 use via env var without code changes |
| Keep `max_completion_tokens` | Preferred over deprecated `max_tokens`; gpt-4.1 supports it |
| Keep `maxDuration = 300` in run route | No-op on Hobby; ready for Pro upgrade |
| Keep captions 12s timeout | Good defensive practice regardless of model |
| Switch to `gpt-image-1.5` | dall-e-3 deprecated; gpt-image-1.5 is a drop-in replacement |
| Generalise image guard to `startsWith('gpt-image-')` | Forward-compatible with future gpt-image-* versions |

---

## Recommended Next Steps

1. **Now:** Stay on gpt-4.1 family. App works reliably on Hobby.
2. **When upgrading to Vercel Pro:** Set `OPENAI_MODEL_PREMIUM=gpt-5` via env var — no code change needed. Test generation time and cost.
3. **When generation time matters:** Implement Inngest background jobs so the UI stays responsive even with slow reasoning models.
