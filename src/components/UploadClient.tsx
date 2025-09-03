'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

type GalleryItem = { id: string; url: string };

type SignResponse = {
  cloudName: string;
  apiKey: string;
  folder: string;
  uploadPreset: string;
  timestamp: number;
  signature: string;
};

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

export default function UploadClient({ initialGallery }: { initialGallery: GalleryItem[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery ?? []);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const MAX_BYTES = 10 * 1024 * 1024;

  const onFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_BYTES) continue;
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
  }, []);

  async function uploadToCloudinarySigned(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; public_id: string; meta: CloudinaryUploadResult }> {
    const signRes = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'social-ai-poc' }),
    });
    if (!signRes.ok) throw new Error(`Signer error ${signRes.status}`);
    const { cloudName, apiKey, folder, uploadPreset, timestamp, signature } =
      (await signRes.json()) as SignResponse;

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);
    form.append('upload_preset', uploadPreset);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const result: CloudinaryUploadResult = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      };
      xhr.onload = () => {
        const raw = xhr.responseText || '';
        try {
          const json = raw ? JSON.parse(raw) : {};
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json as CloudinaryUploadResult);
          } else {
            const msg =
              (json as any)?.error?.message ||
              (json as any)?.message ||
              `Upload failed: ${xhr.status}`;
            reject(new Error(msg));
          }
        } catch {
          reject(new Error(`Upload failed ${xhr.status}: ${raw.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });

    await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId: result.public_id,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
        folder,
      }),
    });

    return { url: result.secure_url, public_id: result.public_id, meta: result };
  }

  const startUpload = useCallback(async () => {
    for (const file of files) {
      setProgress((p) => ({ ...p, [file.name]: 0 }));
      try {
        const res = await uploadToCloudinarySigned(file, (pct) =>
          setProgress((p) => ({ ...p, [file.name]: pct }))
        );
        setGallery((g) => [{ url: res.url, id: res.public_id }, ...g]);
      } catch (err) {
        console.error('Upload error', err);
        setProgress((p) => ({ ...p, [file.name]: -1 }));
      }
    }
    setFiles([]);
  }, [files]);

  const borderClass = dragActive ? 'border-indigo-500' : 'border-dashed border-gray-400';

  return (
    <main className="min-h-dvh p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Day 1 — Upload images to Cloudinary</h1>
          <p className="text-sm text-gray-600">
            Drag & drop or select multiple files. Then hit Upload. Watch per-file progress and see them
            appear in the gallery below.
          </p>
        </header>

        <section>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`rounded-2xl border-2 ${borderClass} bg-white/70 backdrop-blur p-6 flex flex-col items-center justify-center gap-4 text-center`}
          >
            <div className="text-lg font-medium">Drag & drop images here</div>
            <div className="text-xs text-gray-500">PNG, JPG, GIF, WebP (max ~10MB typical free plan)</div>
            <button
              className="px-4 py-2 rounded-xl shadow bg-black text-white hover:opacity-90"
              onClick={() => inputRef.current?.click()}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-gray-700">Ready to upload ({files.length}):</div>
              <ul className="grid gap-3 md:grid-cols-2">
                {files.map((f) => (
                  <li key={f.name} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium truncate max-w-[60%]" title={f.name}>{f.name}</div>
                      <div className="text-xs text-gray-500">{Math.round(f.size / 1024)} KB</div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full ${progress[f.name] === -1 ? 'bg-red-500' : 'bg-black'}`}
                        style={{ width: `${Math.max(0, progress[f.name] ?? 0)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={startUpload}
                  className="px-4 py-2 rounded-xl shadow bg-black text-white hover:opacity-90 disabled:opacity-50"
                  disabled={files.length === 0}
                >
                  Upload {files.length > 1 ? 'files' : 'file'}
                </button>
                <button
                  onClick={() => setFiles([])}
                  className="px-4 py-2 rounded-xl border"
                >
                  Clear list
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Gallery</h2>
          {gallery.length === 0 ? (
            <p className="text-sm text-gray-600">No images yet — upload some!</p>
          ) : (
            <ul className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {gallery.map((img) => (
                <li key={img.id} className="rounded-xl overflow-hidden border bg-white">
                  <a href={img.url} target="_blank" rel="noreferrer">
                    <Image
                      src={img.url}
                      alt={img.id}
                      width={500}
                      height={500}
                      className="aspect-square object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}