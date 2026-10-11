"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSiteCopy } from "./site-copy-provider";
import { Icon } from "./icons";

const themes = [
  { id: "paper", label: "Paper" },
  { id: "sage", label: "Forest" },
  { id: "ink", label: "Ink" },
  { id: "silver", label: "Rose" },
];
let temporaryTheme = "paper";

function readTheme() {
  try {
    const value = localStorage.getItem("lensroom-theme");
    return themes.some((theme) => theme.id === value) ? value! : temporaryTheme;
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
  try { localStorage.setItem("lensroom-theme", value); } catch {}
  window.dispatchEvent(new Event("lensroom-theme-change"));
}

export function StudioLink({ active = false }: { active?: boolean }) {
  const { t } = useSiteCopy();
  return (
    <Link href="/studio" className="studio-icon-link" aria-label={t("Studio")} aria-current={active ? "page" : undefined}>
      <Icon name="aperture" />
      <span className="icon-tooltip" aria-hidden="true">{t("Studio")}</span>
    </Link>
  );
}

export default function SiteHeader({ active }: { active: "gallery" | "studio" | "admin" }) {
  const { t } = useSiteCopy();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "paper");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <header className="masthead">
      <Link className="brand" href="/" aria-label={t("Lensroom home")}>{t("Lensroom")}</Link>
      <nav className="site-nav" aria-label={t("Main navigation")}>
        <Link href="/" aria-current={active === "gallery" ? "page" : undefined}>{t("Gallery")}</Link>
        <StudioLink active={active === "studio"} />
      </nav>
      <div className="theme-switcher" role="group" aria-label={t("Color scheme")}>
        {themes.map((item) => (
          <button key={item.id} type="button" className={`theme-swatch theme-${item.id}`}
            aria-label={`${t(item.label)} ${t("Color scheme")}`} title={`${item.label} color scheme`}
            aria-pressed={theme === item.id} onClick={() => chooseTheme(item.id)}>
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
    </header>
  );
}
