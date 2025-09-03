// lib/blur.ts
// Tiny SVG shimmer placeholder for next/image blurDataURL
const shimmer = (w: number, h: number) => `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g">
        <stop stop-color="#e5e7eb" offset="20%" />
        <stop stop-color="#f3f4f6" offset="50%" />
        <stop stop-color="#e5e7eb" offset="70%" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#e5e7eb"/>
    <rect id="r" width="${w}" height="${h}" fill="url(#g)"/>
    <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
  </svg>
`;

const toBase64 =
  typeof window === 'undefined'
    ? (str: string) => Buffer.from(str).toString('base64')
    : (str: string) => window.btoa(str);

/** Build a data URL for use as next/image blurDataURL. */
export function blurDataURL(w = 16, h = 12) {
  return `data:image/svg+xml;base64,${toBase64(shimmer(w, h))}`;
}
