"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultCopy, mergeCopy, type SiteCopy } from "../site-copy";

const CopyContext = createContext<{ copy: SiteCopy; publish: (copy: SiteCopy) => void }>({ copy: defaultCopy, publish: () => {} });

export function SiteCopyProvider({ children }: { children: ReactNode }) {
  const [copy, setCopy] = useState(defaultCopy);
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      const current = ++sequence.current;
      try {
        const response = await fetch("/api/site-copy", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (current === sequence.current && !controller.signal.aborted) setCopy(mergeCopy(data.copy));
      } catch { /* Keep the last available text if the network is unavailable. */ }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    document.title = copy["Browser title"];
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy["Browser description"]);
  }, [copy]);
  const publish = useCallback((next: SiteCopy) => {
    sequence.current++;
    setCopy(mergeCopy(next));
  }, []);
  return <CopyContext.Provider value={{ copy, publish }}>{children}</CopyContext.Provider>;
}

export function useSiteCopy() {
  const { copy, publish } = useContext(CopyContext);
  return { copy, publish, t: (text: string) => copy[text] ?? text };
}
