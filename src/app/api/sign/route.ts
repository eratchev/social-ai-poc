import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const folder = "social-ai-poc";
  const timestamp = Math.floor(Date.now() / 1000);

  // No need to .config() just to sign; the util only needs the secret
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    apiSecret
  );

  return NextResponse.json({ cloudName, apiKey, folder, timestamp, signature });
}
