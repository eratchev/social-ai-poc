// app/layout.tsx
import './globals.css';
import Link from 'next/link';

export const runtime = 'nodejs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gradient-to-b from-white to-gray-50 text-gray-900 antialiased">
        {/* Top nav */}
        <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold">
              <span className="inline-block h-6 w-6 rounded bg-black" />
              Funny Photo Story
            </Link>
            <div className="text-xs text-gray-500">POC</div>
          </nav>
        </header>

        {/* Page container */}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mt-16 border-t">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
            © {new Date().getFullYear()} Funny Photo Story
          </div>
        </footer>
      </body>
    </html>
  );
}
