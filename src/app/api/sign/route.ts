import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET!;
  const folder = "social-ai-poc";
  const timestamp = Math.floor(Date.now() / 1000);

  // Include preset in the signed params
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp, upload_preset: uploadPreset },
    apiSecret
  );

  return NextResponse.json({
    cloudName,
    apiKey,
    folder,
    uploadPreset,
    timestamp,
    signature,
  });
}
