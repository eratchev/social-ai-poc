// src/app/api/sign/route.ts
import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function signResponse() {
  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey       = process.env.CLOUDINARY_API_KEY!;
  const apiSecret    = process.env.CLOUDINARY_API_SECRET!;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET!; // must be a *signed* preset
  const folder       = process.env.CLOUDINARY_FOLDER ?? 'social-ai-poc';
  const timestamp    = Math.floor(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, upload_preset: uploadPreset },
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

export async function GET()  { return signResponse(); }
export async function POST() { return signResponse(); }
