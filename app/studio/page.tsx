"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import SiteHeader from "../components/site-header";
import Link from "next/link";
import { useSiteCopy } from "../components/site-copy-provider";
import PhotoEditor from "../components/photo-editor";
import { commaValues, photoTopics } from "../photo-metadata";

type Photo = {
  id: number;
  title: string;
  category: string;
  labels: string;
  notes: string;
  imageUrl: string;
  createdAt: string;
};

type Topic = {
  id: number;
  name: string;
  sortOrder: number;
};

type ApiDiagnostics = {
  hasUrl?: boolean;
  hasServiceRoleKey?: boolean;
  hasBucket?: boolean;
  bucketFallsBackToPhotos?: boolean;
};

function apiStatusMessage(
  data: { error?: string; message?: string; diagnostics?: ApiDiagnostics },
  fallback: string,
) {
  const base = data.error || data.message || fallback;
  const diagnostics = data.diagnostics;

  if (!diagnostics) return base;

  return `${base} Vercel sees: URL ${diagnostics.hasUrl ? "yes" : "no"}, service role key ${
    diagnostics.hasServiceRoleKey ? "yes" : "no"
  }, storage bucket ${diagnostics.hasBucket ? "yes" : "no, using photos"}.`;
}

export default function Studio() {
  const { t } = useSiteCopy();
  const photoRequest = useRef(0);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [gateStatus, setGateStatus] = useState("");
  const [oldPassphrase, setOldPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [passphraseStatus, setPassphraseStatus] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicStatus, setTopicStatus] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const loadPhotos = () => {
    const requestId = ++photoRequest.current;
    return fetch("/api/photos", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(30000) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.photos)) throw new Error(data.error || "Could not load saved photos.");
        if (requestId === photoRequest.current) {
          setPhotos(data.photos);
          setPhotosError("");
        }
      })
      .catch((error) => {
        if (requestId === photoRequest.current) setPhotosError(error instanceof Error ? error.message : "Could not load saved photos.");
      })
      .finally(() => { if (requestId === photoRequest.current) setPhotosLoading(false); });
  };

  const loadTopics = () => {
    return fetch("/api/topics", { cache: "no-store", signal: AbortSignal.timeout(30000) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load techniques.");
        setTopics(data.topics ?? []);
      }).catch(() => setTopicStatus("Could not load techniques. Please refresh."));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio-passphrase", { cache: "no-store", signal: AbortSignal.timeout(30000) }).then(async (response) => {
      if (cancelled) return;
      if (response.ok) {
        setUnlocked(true);
        await Promise.all([loadPhotos(), loadTopics()]);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setSessionLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    if (document.querySelector('[data-dirty="true"]') && !window.confirm("Sign out without saving your photo edits?")) return;
    const response = await fetch("/api/studio-passphrase", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setPhotosError("Could not sign out. Please retry."); return; }
    photoRequest.current++;
    setUnlocked(false);
    setPhotos([]);
    setPhotosError("");
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGateStatus("Checking");
    try {
      const response = await fetch("/api/studio-passphrase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase: key }),
      });

      if (response.ok) {
        setUnlocked(true);
        setKey("");
        setGateStatus("");
        setPhotosLoading(true);
        await Promise.all([loadPhotos(), loadTopics()]);
        return;
      }
      setGateStatus(response.status === 401 ? "That passphrase did not work." : "Studio is unavailable. Please try again.");
    } catch {
      setGateStatus("Could not connect. Please try again.");
    }
  }

  async function changePassphrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPassphraseStatus("Updating");
    const response = await fetch("/api/studio-passphrase", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ oldPassphrase, newPassphrase }),
    });

    if (response.ok) {
      setOldPassphrase("");
      setNewPassphrase("");
      setPassphraseStatus("Passphrase updated");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setPassphraseStatus(data.message ?? "Could not update the passphrase");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("photo");
    setStatus("Uploading");

    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      setStatus("Choose an image file first.");
      return;
    }

    setIsUploading(true);
    try {
      const signedUrlResponse = await fetch("/api/photos/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const signedUrlResult = await signedUrlResponse.json().catch(() => ({}));

      if (!signedUrlResponse.ok || !signedUrlResult.signedUrl || !signedUrlResult.storagePath) {
        setStatus(
          apiStatusMessage(
            signedUrlResult,
            `Could not prepare the photo upload. Status ${signedUrlResponse.status}.`,
          ),
        );
        return;
      }

      const storageResponse = await fetch(signedUrlResult.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!storageResponse.ok) {
        setStatus(`Could not upload the photo to Supabase storage. Status ${storageResponse.status}.`);
        return;
      }

      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          storagePath: signedUrlResult.storagePath,
          filename: file.name,
          title: String(data.get("title") || file.name),
          category: photoTopics(String(data.get("category") || "")).join(", "),
          labels: commaValues(String(data.get("labels") || "")).join(", "),
          notes: String(data.get("notes") || ""),
          contentType: file.type,
          size: file.size,
        }),
      });
      const result = await response.json().catch(() => ({}));
      setStatus(
        response.ok
          ? "Saved"
          : apiStatusMessage(result, `Could not save the photo. Status ${response.status}.`),
      );
      if (!response.ok) return;

      form.reset();
      setSelectedFileName("");
      loadPhotos();
      loadTopics();
    } catch (error) {
      setStatus(error instanceof Error ? `Could not save the photo. ${error.message}` : "Could not save the photo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTopicStatus("Adding");
    const response = await fetch("/api/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: topicName }),
    });

    if (response.ok) {
      setTopicName("");
      setTopicStatus("Topic added");
      loadTopics();
      return;
    }

    const data = await response.json().catch(() => ({}));
    setTopicStatus(apiStatusMessage(data, "Could not add the topic"));
  }

  async function renameTopic(topic: Topic, name: string) {
    const nextName = name.trim();
    setTopics((current) =>
      current.map((item) => (item.id === topic.id ? { ...item, name } : item)),
    );

    if (!nextName || nextName === topic.name) return;

    const response = await fetch("/api/topics", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: topic.id, name: nextName }),
    });

    setTopicStatus(response.ok ? "Topic updated" : "Could not update the topic");
    loadTopics();
    loadPhotos();
  }

  async function deleteTopic(topic: Topic) {
    setTopics((current) => current.filter((item) => item.id !== topic.id));
    const response = await fetch("/api/topics", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: topic.id }),
    });

    setTopicStatus(response.ok ? "Topic deleted; other photo topics kept" : "Could not delete the topic");
    loadPhotos();
  }

  async function deletePhoto(photo: Photo) {
    if (!window.confirm(`Delete "${photo.title}" permanently?`)) return;
    try {
      const response = await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Could not delete the photo.");
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setPhotosError("");
    } catch (error) {
      setPhotosError(error instanceof Error ? error.message : "Could not delete the photo.");
    }
  }

  if (sessionLoading) return <main className="studio-shell"><SiteHeader active="studio" /><p role="status">Checking Studio session...</p></main>;

  if (!unlocked) {
    return (
      <main className="studio-shell">
        <SiteHeader active="studio" />
        <section className="studio-gate">
          <form onSubmit={unlock}>
            <p className="eyebrow">{t("Lensroom / Studio")}</p>
            <h1>{t("Welcome back.")}</h1>
            <label className="field">
              <span>{t("Passphrase")}</span>
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                aria-label={t("Studio passphrase")}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={gateStatus === "Checking"}>{gateStatus === "Checking" ? t("Checking...") : t("Enter Studio")}</button>
            <p className="form-status" aria-live="polite">{t(gateStatus)}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <SiteHeader active="studio" />
      <div className="studio-heading">
        <div><p className="eyebrow">{t("Your collection")}</p><h1>{t("Studio")}</h1></div>
        <nav className="section-nav" aria-label={t("Studio sections")}>
          <a href="#upload">{t("Upload")}</a>
          <a href="#photographs">{t("Photographs")}</a>
          <a href="#topics">{t("Topics")}</a>
          <a href="#access">{t("Access")}</a>
          <Link href="/admin">{t("Text admin")}</Link>
          <button className="ghost-button" type="button" onClick={signOut}>Sign out</button>
        </nav>
      </div>

      <section id="upload" className="studio-panel">
        <h2>{t("New photograph")}</h2>
        <form className="upload-form" onSubmit={upload}>
          <div className="upload-file field-wide">
            <label className="upload-picker" htmlFor="photo-upload">
              <span>{t("Choose photo")}</span>
              <small>{selectedFileName || t("No file selected")}</small>
            </label>
            <input
              id="photo-upload"
              className="visually-hidden"
              type="file"
              name="photo"
              accept="image/*"
              required
              onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
            />
          </div>
          <label className="field"><span>{t("Title")}</span><input name="title" placeholder={t("Untitled")} /></label>
          <label className="field"><span>{t("Topics (comma-separated)")}</span><input name="category" placeholder={t("Color, Rule of Thirds")} /></label>
          <label className="field field-wide"><span>{t("Labels (comma-separated)")}</span><input name="labels" placeholder={t("Travel, architecture, evening")} /></label>
          <label className="field field-wide"><span>{t("Notes")}</span><textarea name="notes" /></label>
          <div className="form-actions field-wide">
            <p className="form-status" aria-live="polite">{t(status)}</p>
            <button type="submit" disabled={isUploading}>{isUploading ? t("Uploading...") : t("Save photo")}</button>
          </div>
        </form>
      </section>

      <section id="photographs" className="studio-panel studio-panel-compact" aria-label={t("Uploaded photos")}>
        <div className="section-heading"><h2>{t("Photographs")}</h2><span className="count-badge">{photos.length}</span></div>
        <div className="photo-list-actions">
          <button type="button" className="secondary-button" disabled={photosLoading} onClick={() => {
            if (document.querySelector('[data-dirty="true"]') && !window.confirm("Reload saved photos? Unsaved edits will be kept where possible.")) return;
            setPhotosLoading(true); void loadPhotos();
          }}>{photosLoading ? "Loading saved photos..." : "Refresh saved photos"}</button>
          {photosError && <p className="form-status" role="alert">{photosError}</p>}
        </div>
        <div className="studio-list">
          {!photosLoading && !photosError && !photos.length && <p className="section-empty">{t("No photographs yet.")}</p>}
          {photos.map((photo) => (
            <PhotoEditor key={photo.id} photo={photo} onDelete={deletePhoto}
              onSaved={(savedPhoto) => setPhotos((current) => current.map((item) => item.id === savedPhoto.id ? savedPhoto : item))} />
          ))}
        </div>
      </section>

      <section id="topics" className="studio-panel studio-panel-compact">
        <div className="section-heading"><h2>{t("Topics")}</h2><span className="count-badge">{topics.length}</span></div>
        <form className="inline-form" onSubmit={addTopic}>
          <label className="field"><span>{t("New topics (comma-separated)")}</span>
            <input value={topicName} onChange={(event) => setTopicName(event.target.value)} required />
          </label>
          <button type="submit">{t("Add topics")}</button>
        </form>
        <div className="topic-editor" role="region" tabIndex={0} aria-label={t("Edit topics")}>
          {!topics.length && <p className="section-empty">{t("No topics yet.")}</p>}
          {topics.map((topic) => (
            <div className="topic-row" key={topic.id}>
              <input defaultValue={topic.name} onBlur={(event) => renameTopic(topic, event.target.value)} aria-label={`Rename ${topic.name}`} />
              <button type="button" className="ghost-button" aria-label={`Delete topic ${topic.name}`} onClick={() => deleteTopic(topic)}>{t("Delete")}</button>
            </div>
          ))}
        </div>
        <p className="form-status" aria-live="polite">{t(topicStatus)}</p>
      </section>

      <section id="access" className="studio-panel studio-panel-compact">
        <h2>{t("Studio access")}</h2>
        <form className="upload-form" onSubmit={changePassphrase}>
          <label className="field"><span>{t("Current passphrase")}</span>
            <input value={oldPassphrase} onChange={(event) => setOldPassphrase(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          <label className="field"><span>{t("New passphrase")}</span>
            <input value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} type="password" autoComplete="new-password" required />
          </label>
          <div className="form-actions field-wide">
            <p className="form-status" aria-live="polite">{t(passphraseStatus)}</p>
            <button type="submit" className="secondary-button">{t("Update passphrase")}</button>
          </div>
        </form>
      </section>
      <footer className="site-footer"><span>{t("Lensroom")}</span><Link href="/">{t("Back to gallery")}</Link></footer>
    </main>
  );
}
