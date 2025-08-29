import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social AI POC — Day 1',
  description: 'Upload to Cloudinary',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
