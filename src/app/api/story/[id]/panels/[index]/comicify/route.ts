import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';
import type { Panel } from '@/lib/ai/structured';
import { buildComicPrompt } from '@/lib/ai/comic-image';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const { id: storyId, index: indexStr } = await params;
    const panelIndex = parseInt(indexStr, 10);

    if (isNaN(panelIndex)) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    // 1. Load story
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { status: true, panelMap: true },
    });

    if (!story) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (story.status !== 'READY') {
      return NextResponse.json({ error: 'story_not_ready' }, { status: 400 });
    }

    // 2. Find the panel by its logical index field
    const panels = (Array.isArray(story.panelMap) ? story.panelMap : []) as Panel[];
    const panel = panels.find((p) => p.index === panelIndex);

    if (!panel) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (!panel.photoId) {
      return NextResponse.json({ error: 'no_photo' }, { status: 400 });
    }

    // 3. Look up photo storageUrl and format
    const photo = await prisma.photo.findUnique({
      where: { id: panel.photoId },
      select: { storageUrl: true, format: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // 4. Fetch photo bytes
    const photoRes = await fetch(photo.storageUrl);
    if (!photoRes.ok) {
      throw new Error(`Failed to fetch photo: ${photoRes.status}`);
    }
    const buffer = Buffer.from(await photoRes.arrayBuffer());
    const mimeType = photo.format ? `image/${photo.format}` : 'image/jpeg';
    const imageFile = new File([buffer], `panel.${photo.format ?? 'jpg'}`, { type: mimeType });

    // 5. Generate comic illustration via OpenAI
    const result = await openai.images.edit({
      model: 'dall-e-2',
      image: imageFile,
      prompt: buildComicPrompt(panel),
      response_format: 'b64_json',
    });

    const b64json = result.data?.[0]?.b64_json;
    if (!b64json) {
      return NextResponse.json({ error: 'No image data returned from OpenAI' }, { status: 500 });
    }

    // 6. Upload to Cloudinary as a data URI
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${b64json}`,
      { folder: process.env.CLOUDINARY_FOLDER ?? 'social-ai-poc' }
    );
    const generatedImageUrl = uploadResult.secure_url;

    // 7. Re-read panelMap to minimize write-write race window, then patch
    const freshStory = await prisma.story.findUnique({
      where: { id: storyId },
      select: { panelMap: true },
    });
    const latestPanels = (Array.isArray(freshStory?.panelMap) ? freshStory!.panelMap : panels) as Panel[];
    const updatedPanelMap = latestPanels.map((p) =>
      p.index === panelIndex ? { ...p, generatedImageUrl } : p
    );
    await prisma.story.update({
      where: { id: storyId },
      data: { panelMap: updatedPanelMap },
    });

    return NextResponse.json({ generatedImageUrl });
  } catch (err) {
    console.error('POST /api/story/[id]/panels/[index]/comicify error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
