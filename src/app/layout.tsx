import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Inter, Bangers } from "next/font/google";
import ThemeProvider from "./providers/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

export const runtime = "nodejs";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bangers = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-bangers" });

export const metadata: Metadata = {
  title: "Funny Photo Story",
  description: "Turn your photos into comic-style adventures",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${bangers.variable} min-h-full
                    bg-gradient-to-b from-white to-gray-50 text-gray-900 antialiased
                    dark:bg-zinc-950 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100`}
      >
        <ThemeProvider>
          {/* Top nav */}
          <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
            <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 font-semibold font-[var(--font-bangers)] text-xl tracking-tight"
              >
                <span className="inline-block h-6 w-6 rounded bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" />
                Funny Photo Story
              </Link>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="text-xs text-zinc-500 dark:text-zinc-400">POC</div>
              </div>
            </nav>
          </header>

          {/* Page container */}
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

          {/* Footer */}
          <footer className="mt-16 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-zinc-500 dark:text-zinc-400">
              © {new Date().getFullYear()} Funny Photo Story
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
