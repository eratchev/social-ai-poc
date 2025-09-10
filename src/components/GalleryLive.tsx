'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Photo = { id: string; storageUrl: string; width: number | null; height: number | null; publicId: string | null };

function fallbackWH(w: number | null, h: number | null) {
  return { w: w && w > 0 ? w : 1200, h: h && h > 0 ? h : 900 };
}

// Cloudinary thumb helper: inject a lightweight transform
function thumb(url: string, w = 800) {
  // turns .../upload/v123/abc.jpg -> .../upload/c_fill,q_auto,f_auto,w_800/v123/abc.jpg
  try {
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;
    return `${parts[0]}/upload/c_fill,q_auto,f_auto,w_${w}/${parts[1]}`;
  } catch {
    return url;
  }
}

export default function GalleryLive({ roomCode, initial }: { roomCode: string; initial: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomCode}/photos`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setPhotos(json.photos || []);
  }, [roomCode]);

  // Refresh when the page gains focus, and when uploader broadcasts new photos.
  useEffect(() => {
    const onFocus = () => fetchPhotos();
    window.addEventListener('focus', onFocus);
    const onAdded = () => fetchPhotos();
    window.addEventListener('photos:added', onAdded as EventListener);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('photos:added', onAdded as EventListener);
    };
  }, [fetchPhotos]);

  const count = photos.length;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Gallery</h2>
        <span className="muted">
          {count} item{count === 1 ? '' : 's'}
        </span>
      </div>

      {count === 0 ? (
        <p className="muted">No images yet — upload some below!</p>
      ) : (
        <ul className="columns-2 md:columns-3 gap-4 [column-fill:_balance]">
          {photos.map((p, i) => {
            const { w, h } = fallbackWH(p.width, p.height);
            const src = thumb(p.storageUrl, 800);
            return (
              <li
                key={p.id}
                className="mb-4 break-inside-avoid rounded-xl border bg-white overflow-hidden"
                title={p.publicId || p.id}
              >
                <a href={p.storageUrl} target="_blank" rel="noreferrer" className="block">
                  <Image
                    src={src}
                    alt={p.publicId || p.id}
                    width={w}
                    height={h}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="w-full h-auto object-cover"
                    priority={i < 6}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
