"use client";

import Image from "next/image";
import { useState } from "react";

export default function PhotoImage({ src, alt, thumbnail = false, eager = false }: {
  src: string; alt: string; thumbnail?: boolean; eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className={`photo-image ${thumbnail ? "photo-thumbnail" : ""}`} data-loaded={loaded}>
    {!failed && <Image key={attempt} src={src} alt={alt} width={1600} height={1200}
      sizes={thumbnail ? "(max-width: 620px) 320px, 220px" : "(max-width: 620px) calc(100vw - 40px), (max-width: 960px) 45vw, 430px"}
      quality={75} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"}
      decoding="async" draggable={false}
      onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} />}
    {failed && <div className="image-error" role="status">
      <span>Preview unavailable</span>
      <button type="button" className="secondary-button" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Retry preview</button>
      <a href={src} target="_blank" rel="noreferrer">Open original</a>
    </div>}
  </div>;
}
