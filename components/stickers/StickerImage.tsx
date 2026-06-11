// components/stickers/StickerImage.tsx
"use client";
import { useState } from "react";

interface StickerImageProps {
  src?: string | null;       // imageThumbUrl or imageFullUrl
  emoji?: string | null;     // legacy fallback
  alt: string;
  className?: string;
  sizePx?: number;           // intrinsic size hint
}

// Renders the real sticker art with a graceful fallback chain:
// image -> legacy emoji -> ❓. Keeps a fixed square box (no layout shift).
export default function StickerImage({ src, emoji, alt, className = "", sizePx = 96 }: StickerImageProps) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: "100%", aspectRatio: "1 / 1" }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={sizePx}
          height={sizePx}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <span className="text-4xl" aria-label={alt}>{emoji || "❓"}</span>
      )}
    </span>
  );
}
