#!/usr/bin/env node
// Quick smoke test: verifies each configured model responds without error.
// Usage: node scripts/test-models.mjs

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of envFile.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const PROMPT = 'Reply with exactly one word: hello';

async function testOpenAI(model) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_completion_tokens: 10 }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
  return json.choices?.[0]?.message?.content?.trim();
}

async function testOpenAIImage(model) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model, prompt: 'a red circle', size: '1024x1024', n: 1 }),
  }, { signal: AbortSignal.timeout(90000) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
  const d = json.data?.[0];
  return d?.url ? 'url received' : d?.b64_json ? 'b64_json received' : d?.b64 ? 'b64 received' : `unknown format: ${JSON.stringify(Object.keys(d ?? {}))}`;
}

async function testAnthropic(model) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 10 }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json.error?.message ?? JSON.stringify(json));
  return json.content?.[0]?.text?.trim();
}

async function run(label, fn) {
  process.stdout.write(`  ${label.padEnd(40)}`);
  try {
    const result = await fn();
    console.log(`✓  "${result}"`);
  } catch (e) {
    console.log(`✗  ${e.message}`);
  }
}

console.log('\nOpenAI models:');
await run('gpt-5-mini (fast/balanced/captions)', () => testOpenAI('gpt-5-mini'));
await run('gpt-5 (premium/vision)',              () => testOpenAI('gpt-5'));
await run('gpt-image-1 (comicify image)',        () => testOpenAIImage('gpt-image-1'));

console.log('\nAnthropic models:');
await run('claude-haiku-4-5-20251001 (fast)',    () => testAnthropic('claude-haiku-4-5-20251001'));
await run('claude-sonnet-4-6 (balanced)',        () => testAnthropic('claude-sonnet-4-6'));
await run('claude-opus-4-6 (premium)',           () => testAnthropic('claude-opus-4-6'));

console.log('');
