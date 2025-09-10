'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

type UploadClientProps = {
  initialGallery: GalleryItem[]; // not rendered here; room page shows gallery
  roomCode: string;
  ownerHandle?: string;
};

export default function UploadClient({
  initialGallery: _,
  roomCode,
  ownerHandle = 'devuser',
}: UploadClientProps) {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [dragActive, setDragActive] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const MAX_BYTES = 10 * 1024 * 1024;

  // ---------- Helpers ----------
  const pushFiles = useCallback((incoming: File[]) => {
    if (!incoming.length) return;
    const accepted = incoming.filter(f => f.type.startsWith('image/') && f.size <= MAX_BYTES);
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  }, []);

  const acceptFileList = useCallback((list: FileList | null) => {
    if (!list) return;
    pushFiles(Array.from(list));
  }, [pushFiles]);

  async function urlToFile(url: string): Promise<File | null> {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;
      const ext = blob.type.split('/')[1] || 'jpg';
      const name = `pasted-${Date.now()}.${ext}`;
      return new File([blob], name, { type: blob.type });
    } catch {
      return null;
    }
  }

  // ---------- Drag & Drop (Files + URL drops) ----------
  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const zone = dropRef.current;
    const related = e.relatedTarget as Node | null;
    if (zone && related && zone.contains(related)) return;
    setDragActive(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptFileList(e.dataTransfer.files);
      return;
    }

    const items = e.dataTransfer.items ? Array.from(e.dataTransfer.items) : [];
    for (const it of items) {
      if (it.kind === 'string' && (it.type === 'text/uri-list' || it.type === 'text/plain')) {
        const url = await new Promise<string>(resolve => it.getAsString(resolve));
        const trimmed = url.trim();
        try {
          const u = new URL(trimmed);
          if (u.protocol === 'http:' || u.protocol === 'https:') {
            const f = await urlToFile(trimmed);
            if (f) pushFiles([f]);
          }
        } catch { /* ignore non-URL */ }
      }
    }
  }, [acceptFileList, pushFiles]);

  // ---------- Paste (Cmd+V: image blob or URL) ----------
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items && items.length) {
        const imgs: File[] = [];
        for (const it of items) {
          if (it.kind === 'file') {
            const f = it.getAsFile();
            if (f) imgs.push(f);
          }
        }
        if (imgs.length) {
          e.preventDefault();
          pushFiles(imgs);
          return;
        }
      }
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        try {
          const u = new URL(text);
          if (u.protocol === 'http:' || u.protocol === 'https:') {
            e.preventDefault();
            const f = await urlToFile(text);
            if (f) pushFiles([f]);
          }
        } catch { /* ignore non-URL paste */ }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pushFiles]);

  // ---------- Upload ----------
  async function uploadToCloudinarySigned(
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; public_id: string; meta: CloudinaryUploadResult }> {
    const perRoomFolder = `social-ai-poc/${roomCode}`;

    const signRes = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: perRoomFolder }),
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
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        const raw = xhr.responseText || '';
        try {
          const json = raw ? JSON.parse(raw) : {};
          if (xhr.status >= 200 && xhr.status < 300) resolve(json as CloudinaryUploadResult);
          else reject(new Error((json as any)?.error?.message || `Upload failed: ${xhr.status}`));
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
        roomCode,
        ownerHandle,
      }),
    });

    // instantly re-render server components (gallery count & list) without full reload
    router.refresh();

    return { url: result.secure_url, public_id: result.public_id, meta: result };
  }

  // Upload concurrently (3 at a time) for speed
  async function uploadMany(batch: File[], worker = 3) {
    const queue = [...batch];
    const workers = Array.from({ length: Math.min(worker, queue.length) }, async () => {
      while (queue.length) {
        const f = queue.shift()!;
        try {
          setProgress((p) => ({ ...p, [f.name]: 0 }));
          await uploadToCloudinarySigned(f, (pct) =>
            setProgress((p) => ({ ...p, [f.name]: pct }))
          );
        } catch {
          setProgress((p) => ({ ...p, [f.name]: -1 }));
        }
      }
    });
    await Promise.all(workers);
  }

  const startUpload = useCallback(async () => {
    if (files.length === 0) return;
    await uploadMany(files, 3);
    setFiles([]);
  }, [files]);

  // ---------- UI ----------
  const dzBase = 'relative rounded-2xl border-2 p-10 flex flex-col items-center justify-center gap-3 text-center transition';
  const dzInactive = 'border-dashed border-gray-300 bg-white/70 backdrop-blur';
  const dzActive = 'ring-4 ring-indigo-400 border-indigo-400 bg-indigo-50/70';

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div
          ref={dropRef}
          id="dropzone"
          role="button"
          tabIndex={0}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`${dzBase} ${dragActive ? dzActive : dzInactive}`}
          style={{ minHeight: 220 }}
        >
          <div className="text-base font-semibold">
            {dragActive ? 'Drop to upload' : 'Drag & drop images here'}
          </div>
          <div className="text-xs text-gray-600">
            {dragActive
              ? 'Release mouse to add files'
              : 'PNG, JPG, GIF, WebP · up to ~10MB each · Tip: You can also paste (⌘V) or drop an image URL'}
          </div>
          <button className="btn btn-outline" onClick={() => inputRef.current?.click()}>
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => acceptFileList(e.target.files)}
          />
          {dragActive && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl border-4 border-indigo-400/70" />
          )}
        </div>

        {/* Selected files + progress */}
        {files.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Ready to upload <span className="font-medium">{files.length}</span>{' '}
                file{files.length > 1 ? 's' : ''}:
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startUpload}
                  className="btn btn-primary disabled:opacity-50"
                  disabled={files.length === 0}
                >
                  Upload {files.length > 1 ? 'files' : 'file'}
                </button>
                <button onClick={() => setFiles([])} className="btn btn-outline">
                  Clear list
                </button>
              </div>
            </div>

            <ul className="grid gap-3 md:grid-cols-2">
              {files.map((f) => {
                const pct = progress[f.name] ?? 0;
                const isErr = pct === -1;
                return (
                  <li key={f.name} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-medium" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-xs text-gray-500">{Math.round(f.size / 1024)} KB</div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${isErr ? 'bg-red-500' : 'bg-black'}`}
                        style={{ width: `${Math.max(0, pct)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {isErr ? 'Upload failed' : pct ? `${pct}%` : 'Queued'}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold mb-2">Paste support</h3>
        <p className="muted">
          You can also <strong>paste</strong> images or image URLs (⌘V) directly into this page.
        </p>
      </section>
    </div>
  );
}
