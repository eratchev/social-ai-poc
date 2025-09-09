'use client';
import Link from 'next/link';

export default function HomeLink() {
  return (
    <Link href="/" className="btn btn-outline">
      ⬅ Home
    </Link>
  );
}
