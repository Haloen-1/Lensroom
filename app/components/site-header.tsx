"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

const themes = ["paper", "sage", "ink", "silver"];
let temporaryTheme = "paper";

function readTheme() {
  try {
    const value = localStorage.getItem("lensroom-theme");
    return value && themes.includes(value) ? value : temporaryTheme;
  } catch {
    return temporaryTheme;
  }
}

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("lensroom-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("lensroom-theme-change", callback);
  };
}

function chooseTheme(value: string) {
  temporaryTheme = value;
  try {
    localStorage.setItem("lensroom-theme", value);
  } catch {}
  window.dispatchEvent(new Event("lensroom-theme-change"));
}

export default function SiteHeader({ active }: { active: "gallery" | "studio" }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "paper");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <header className="masthead">
      <Link className="brand" href="/" aria-label="Lensroom home">Lensroom<span aria-hidden="true">.</span></Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/" aria-current={active === "gallery" ? "page" : undefined}>Gallery</Link>
        <Link href="/studio" aria-current={active === "studio" ? "page" : undefined}>Studio</Link>
      </nav>
      <div className="theme-switcher" role="group" aria-label="Color scheme">
        {themes.map((item) => (
          <button
            key={item}
            type="button"
            className={`theme-swatch theme-${item}`}
            aria-label={`${item} color scheme`}
            title={`${item.charAt(0).toUpperCase()}${item.slice(1)} color scheme`}
            aria-pressed={theme === item}
            onClick={() => chooseTheme(item)}
          ><span aria-hidden="true" /></button>
        ))}
      </div>
    </header>
  );
}
