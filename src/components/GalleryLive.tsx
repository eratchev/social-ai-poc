'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type Photo = { id: string; storageUrl: string; width: number | null; height: number | null; publicId: string | null };

function fallbackWH(w: number | null, h: number | null) {
  return { w: w && w > 0 ? w : 1200, h: h && h > 0 ? h : 900 };
}

function thumb(url: string, w = 800) {
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
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [errorId, setErrorId] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomCode}/photos`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setPhotos(json.photos || []);
  }, [roomCode]);

  useEffect(() => {
    const onFocus = () => fetchPhotos();
    const onAdded = () => fetchPhotos();
    window.addEventListener('focus', onFocus);
    window.addEventListener('photos:added', onAdded as EventListener);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('photos:added', onAdded as EventListener);
    };
  }, [fetchPhotos]);

  const handleDelete = useCallback(async (id: string) => {
    if (deletingIds.has(id)) return;

    const photoIndex = photos.findIndex(p => p.id === id);
    const photo = photos[photoIndex];
    if (!photo) return;

    // Optimistic remove
    setPhotos(prev => prev.filter(p => p.id !== id));
    setDeletingIds(prev => new Set([...prev, id]));

    try {
      const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
      // 404 means already gone — treat as success
      if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    } catch {
      // Restore photo at its original position
      setPhotos(prev => {
        const next = [...prev];
        next.splice(Math.min(photoIndex, next.length), 0, photo);
        return next;
      });
      setErrorId(id);
      setTimeout(() => setErrorId(null), 2000);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [deletingIds, photos]);

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
            const isDeleting = deletingIds.has(p.id);
            const hasError = errorId === p.id;
            return (
              <li
                key={p.id}
                className={[
                  'mb-4 break-inside-avoid rounded-xl border bg-white overflow-hidden relative group',
                  hasError ? 'ring-2 ring-red-500' : '',
                ].join(' ')}
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
                <button
                  aria-label="Delete photo"
                  onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}
                  disabled={isDeleting}
                  className={[
                    'absolute top-1.5 right-1.5 z-10 w-6 h-6 flex items-center justify-center',
                    'rounded-full bg-black/70 hover:bg-black text-white',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  {isDeleting ? (
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
