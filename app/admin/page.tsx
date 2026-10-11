"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import SiteHeader from "../components/site-header";
import { useSiteCopy } from "../components/site-copy-provider";
import { defaultCopy, mergeCopy, textGroups } from "../site-copy";

export default function TextAdmin() {
  const { publish } = useSiteCopy();
  const [state, setState] = useState<"loading" | "locked" | "ready" | "error">("loading");
  const [draft, setDraft] = useState(defaultCopy);
  const [saved, setSaved] = useState(defaultCopy);
  const [version, setVersion] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState(Object.keys(textGroups)[0]);
  const [query, setQuery] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const count = Object.keys(defaultCopy).filter((key) => draft[key] !== saved[key]).length;

  function load(signal?: AbortSignal) {
    return fetch("/api/site-copy?admin=1", { cache: "no-store", signal }).then(async (response) => {
      if (response.status === 401) { setState("locked"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load website text.");
      const next = mergeCopy(data.copy);
      setDraft(next); setSaved(next); setVersion(data.version); setState("ready");
      setMessage(""); setFailed(false);
    }).catch((error) => {
      if (signal?.aborted) return;
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not load website text.");
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/studio-passphrase", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "That passphrase did not work." : "Sign in is unavailable. Please retry.");
      setPassphrase("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  function edit(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(""); setFailed(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || !dirty) return;
    if (Object.values(draft).some((value) => !value.trim() || value.length > 500)) {
      setFailed(true); setMessage("Each text must contain 1 to 500 characters."); return;
    }
    busyRef.current = true; setBusy(true); setFailed(false); setMessage("Publishing...");
    try {
      const response = await fetch("/api/site-copy", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ copy: draft, version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Open Studio in another tab to sign in, then retry here." : data.error || "Could not publish text.");
      const next = mergeCopy(data.copy);
      setDraft(next); setSaved(next); setVersion(data.version);
      publish(next); setMessage("Published");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Could not publish. Your edits are still here.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  const fields = Object.entries(textGroups).flatMap(([section, keys]) =>
    keys.filter((key) => query.trim()
      ? (key + " " + draft[key]).toLowerCase().includes(query.trim().toLowerCase())
      : section === group).map((key) => ({ key, section })),
  );

  return (
    <main className="studio-shell admin-shell" onClickCapture={(event) => {
      if (dirty && (event.target as HTMLElement).closest("a[href]") &&
        !window.confirm("Leave without publishing your text changes?")) { event.preventDefault(); event.stopPropagation(); }
    }}>
      <SiteHeader active="admin" />
      {state === "locked" ? <section className="studio-gate">
        <form onSubmit={unlock}>
          <p className="eyebrow">Lensroom / Admin</p><h1>Website text</h1>
          <label className="field"><span>Studio passphrase</span>
            <input type="password" autoComplete="current-password" required value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
          </label>
          <button disabled={busy}>{busy ? "Checking..." : "Enter text admin"}</button>
          <p className="form-status" role="alert">{message}</p>
        </form>
      </section> : state !== "ready" ? <section className="empty-state">
        <h1>Website text</h1><p role="status">{state === "loading" ? "Loading saved text..." : message}</p>
        {state === "error" && <button onClick={() => { setState("loading"); void load(); }}>Retry</button>}
      </section> : <>
        <div className="studio-heading">
          <div><p className="eyebrow">Administration</p><h1>Website text</h1></div>
          <nav className="section-nav" aria-label="Admin navigation">
            <Link href="/studio">Photo studio</Link><Link href="/">View website</Link>
          </nav>
        </div>
        <form onSubmit={save}>
          <div className="admin-actions">
            <p role={failed ? "alert" : "status"} className="form-status">{message || (dirty ? `${count} unpublished changes` : "All changes published")}</p>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => {
              if (!dirty || window.confirm("Discard unpublished edits and reload saved text?")) { setState("loading"); void load(); }
            }}>Reload saved text</button>
            <button type="submit" disabled={busy || !dirty}>{busy ? "Publishing..." : "Publish changes"}</button>
          </div>
          <div className="admin-workspace">
            <aside className="admin-sidebar">
              <label className="field"><span>Search text</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="admin-tabs" role="tablist" aria-label="Text sections">
                {Object.keys(textGroups).map((section, index) => <button type="button" role="tab" key={section}
                  id={`text-tab-${index}`} aria-controls="text-fields" aria-selected={!query && section === group}
                  tabIndex={(!query && section === group) || (!!query && index === 0) ? 0 : -1}
                  onKeyDown={(event) => {
                    const sections = Object.keys(textGroups);
                    const delta = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
                    if (!delta && !["Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : (index + delta + sections.length) % sections.length;
                    setGroup(sections[next]); setQuery("");
                    document.getElementById(`text-tab-${next}`)?.focus();
                  }}
                  onClick={() => { setGroup(section); setQuery(""); }}>
                  {section}
                </button>)}
              </div>
            </aside>
            <section className="admin-fields" id="text-fields" role={query ? "region" : "tabpanel"}
              aria-label={query ? "Search results" : undefined}
              aria-labelledby={query ? undefined : `text-tab-${Object.keys(textGroups).indexOf(group)}`}>
              <h2>{query ? "Search results" : group}<span className="count-badge">{fields.length}</span></h2>
              {!fields.length && <p className="section-empty">No matching text</p>}
              {fields.map(({ key, section }) => <div className="admin-text-field" key={key}>
                <label className="field">
                  <span>{key}</span>
                  {query && <small>{section}</small>}
                  <textarea aria-label={key} maxLength={500} required disabled={busy}
                    rows={2} value={draft[key]} onChange={(event) => edit(key, event.target.value)} />
                </label>
                <div className="admin-field-meta">
                  <span>{draft[key].length}/500</span>
                  <button type="button" className="ghost-button" disabled={busy || draft[key] === defaultCopy[key]}
                    aria-label={`Reset ${key} to default`} onClick={() => edit(key, defaultCopy[key])}>Reset default</button>
                </div>
              </div>)}
            </section>
          </div>
        </form>
      </>}
    </main>
  );
}
