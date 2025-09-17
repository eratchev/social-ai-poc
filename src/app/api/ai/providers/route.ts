import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const openai = !!process.env.OPENAI_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    openai,
    anthropic,
    mock: true,
    default: openai ? "openai" : anthropic ? "anthropic" : "mock",
  });
}
