"use client";

import { FormEvent, useEffect, useState } from "react";
import SiteHeader from "../components/site-header";
import Link from "next/link";

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
    fetch("/api/photos")
      .then((response) => response.json())
      .then((data: { photos: Photo[] }) => setPhotos(data.photos ?? []));
  };

  const loadTopics = () => {
    fetch("/api/topics")
      .then((response) => response.json())
      .then((data: { topics: Topic[] }) => setTopics(data.topics ?? []));
  };

  useEffect(() => {
    loadPhotos();
    loadTopics();
  }, []);

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
        loadTopics();
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
          category: String(data.get("category") || "Unsorted"),
          labels: String(data.get("labels") || ""),
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

    setTopicStatus(response.ok ? "Topic deleted; photos moved to Unsorted" : "Could not delete the topic");
    loadPhotos();
  }

  async function updatePhoto(photo: Photo, field: keyof Photo, value: string) {
    const next = { ...photo, [field]: value };
    setPhotos((current) => current.map((item) => (item.id === photo.id ? next : item)));
    await fetch(`/api/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function deletePhoto(photo: Photo) {
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
  }

  if (!unlocked) {
    return (
      <main className="studio-shell">
        <SiteHeader active="studio" />
        <section className="studio-gate">
          <form onSubmit={unlock}>
            <p className="eyebrow">Lensroom / Studio</p>
            <h1>Welcome back.</h1>
            <label className="field">
              <span>Passphrase</span>
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                aria-label="Studio passphrase"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={gateStatus === "Checking"}>{gateStatus === "Checking" ? "Checking..." : "Enter Studio"}</button>
            <p className="form-status" aria-live="polite">{gateStatus}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <SiteHeader active="studio" />
      <div className="studio-heading">
        <div><p className="eyebrow">Your collection</p><h1>Studio</h1></div>
        <nav className="section-nav" aria-label="Studio sections">
          <a href="#upload">Upload</a>
          <a href="#photographs">Photographs</a>
          <a href="#topics">Topics</a>
          <a href="#access">Access</a>
        </nav>
      </div>

      <section id="upload" className="studio-panel">
        <h2>New photograph</h2>
        <form className="upload-form" onSubmit={upload}>
          <div className="upload-file field-wide">
            <label className="upload-picker" htmlFor="photo-upload">
              <span>Choose photo</span>
              <small>{selectedFileName || "No file selected"}</small>
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
          <label className="field"><span>Title</span><input name="title" placeholder="Untitled" /></label>
          <label className="field"><span>Topic</span><input name="category" list="topic-options" placeholder="Unsorted" /></label>
          <datalist id="topic-options">
            {topics.map((topic) => <option key={topic.id} value={topic.name} />)}
          </datalist>
          <label className="field field-wide"><span>Labels</span><input name="labels" placeholder="Travel, architecture, evening" /></label>
          <label className="field field-wide"><span>Notes</span><textarea name="notes" /></label>
          <div className="form-actions field-wide">
            <p className="form-status" aria-live="polite">{status}</p>
            <button type="submit" disabled={isUploading}>{isUploading ? "Uploading..." : "Save photo"}</button>
          </div>
        </form>
      </section>

      <section id="photographs" className="studio-panel studio-panel-compact" aria-label="Uploaded photos">
        <div className="section-heading"><h2>Photographs</h2><span className="count-badge">{photos.length}</span></div>
        <div className="studio-list">
          {!photos.length && <p className="section-empty">No photographs yet.</p>}
          {photos.map((photo) => (
            <article key={photo.id} className="studio-item">
              <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
              <div className="photo-fields">
                <label className="field">
                  <span>Title</span>
                  <input value={photo.title} onChange={(event) => updatePhoto(photo, "title", event.target.value)} aria-label="Photo title" />
                </label>
                <label className="field">
                  <span>Topic</span>
                  <input value={photo.category} onChange={(event) => updatePhoto(photo, "category", event.target.value)} aria-label="Photo category" list="topic-options" />
                </label>
                <label className="field field-wide">
                  <span>Labels</span>
                  <input value={photo.labels} onChange={(event) => updatePhoto(photo, "labels", event.target.value)} aria-label="Photo labels" />
                </label>
                <label className="field field-wide">
                  <span>Notes</span>
                  <textarea value={photo.notes} onChange={(event) => updatePhoto(photo, "notes", event.target.value)} aria-label="Photo notes" />
                </label>
                <div className="form-actions field-wide">
                  <button type="button" className="danger-button" onClick={() => deletePhoto(photo)}>Delete photo</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="topics" className="studio-panel studio-panel-compact">
        <div className="section-heading"><h2>Topics</h2><span className="count-badge">{topics.length}</span></div>
        <form className="inline-form" onSubmit={addTopic}>
          <label className="field"><span>New topic</span>
            <input value={topicName} onChange={(event) => setTopicName(event.target.value)} required />
          </label>
          <button type="submit">Add topic</button>
        </form>
        <div className="topic-editor" role="region" tabIndex={0} aria-label="Edit topics">
          {!topics.length && <p className="section-empty">No topics yet.</p>}
          {topics.map((topic) => (
            <div className="topic-row" key={topic.id}>
              <input defaultValue={topic.name} onBlur={(event) => renameTopic(topic, event.target.value)} aria-label={`Rename ${topic.name}`} />
              <button type="button" className="ghost-button" aria-label={`Delete topic ${topic.name}`} onClick={() => deleteTopic(topic)}>Delete</button>
            </div>
          ))}
        </div>
        <p className="form-status" aria-live="polite">{topicStatus}</p>
      </section>

      <section id="access" className="studio-panel studio-panel-compact">
        <h2>Studio access</h2>
        <form className="upload-form" onSubmit={changePassphrase}>
          <label className="field"><span>Current passphrase</span>
            <input value={oldPassphrase} onChange={(event) => setOldPassphrase(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          <label className="field"><span>New passphrase</span>
            <input value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} type="password" autoComplete="new-password" required />
          </label>
          <div className="form-actions field-wide">
            <p className="form-status" aria-live="polite">{passphraseStatus}</p>
            <button type="submit" className="secondary-button">Update passphrase</button>
          </div>
        </form>
      </section>
      <footer className="site-footer"><span>Lensroom</span><Link href="/">Back to gallery</Link></footer>
    </main>
  );
}
