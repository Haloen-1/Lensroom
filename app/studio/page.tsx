"use client";

import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
    const savedTheme = localStorage.getItem("lensroom-theme") || "paper";
    document.documentElement.dataset.theme = savedTheme;
  }, []);

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

    setGateStatus("That passphrase did not work.");
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
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("photo");
    setStatus("Uploading");

    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      setStatus("Choose an image file first.");
      return;
    }

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
      <main className="studio-gate">
        <form onSubmit={unlock}>
          <a href="/" className="brand">
            Lensroom
          </a>
          <h1>Studio</h1>
          <p>Private labeling entrance</p>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Passphrase"
            aria-label="Studio passphrase"
            type="password"
          />
          <button type="submit">Enter</button>
          <p aria-live="polite">{gateStatus}</p>
        </form>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <header className="masthead">
        <a className="brand" href="/">
          Lensroom
        </a>
        <a href="/">Public gallery</a>
      </header>

      <section className="studio-panel">
        <h1>Upload And Label</h1>
        <form className="upload-form" onSubmit={upload}>
          <label className="upload-picker" htmlFor="photo-upload">
            <span>Choose photo</span>
            <small>{selectedFileName || "Ready to upload"}</small>
          </label>
          <input
            id="photo-upload"
            className="visually-hidden"
            type="file"
            name="photo"
            accept="image/*"
            required
            onChange={(event) =>
              setSelectedFileName(event.target.files?.[0]?.name ?? "")
            }
          />
          <input name="title" placeholder="Photo title" />
          <input name="category" list="topic-options" placeholder="Topic, e.g. Food" />
          <datalist id="topic-options">
            {topics.map((topic) => (
              <option key={topic.id} value={topic.name} />
            ))}
          </datalist>
          <input name="labels" placeholder="Hover labels, comma separated" />
          <textarea name="notes" placeholder="Private notes" />
          <button type="submit">Save photo</button>
        </form>
        <p aria-live="polite">{status}</p>
      </section>

      <section className="studio-panel studio-panel-compact">
        <h2>Topics</h2>
        <form className="inline-form" onSubmit={addTopic}>
          <input
            value={topicName}
            onChange={(event) => setTopicName(event.target.value)}
            placeholder="New topic"
            aria-label="New topic"
            required
          />
          <button type="submit">Add topic</button>
        </form>
        <div className="topic-editor" aria-label="Edit topics">
          {topics.map((topic) => (
            <div className="topic-row" key={topic.id}>
              <input
                defaultValue={topic.name}
                onBlur={(event) => renameTopic(topic, event.target.value)}
                aria-label={`Rename ${topic.name}`}
              />
              <button type="button" className="ghost-button" onClick={() => deleteTopic(topic)}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <p aria-live="polite">{topicStatus}</p>
      </section>

      <section className="studio-panel studio-panel-compact">
        <h2>Change Passphrase</h2>
        <form className="upload-form" onSubmit={changePassphrase}>
          <input
            value={oldPassphrase}
            onChange={(event) => setOldPassphrase(event.target.value)}
            placeholder="Old passphrase"
            aria-label="Old passphrase"
            type="password"
            required
          />
          <input
            value={newPassphrase}
            onChange={(event) => setNewPassphrase(event.target.value)}
            placeholder="New passphrase"
            aria-label="New passphrase"
            type="password"
            required
          />
          <button type="submit">Update passphrase</button>
        </form>
        <p aria-live="polite">{passphraseStatus}</p>
      </section>

      <section className="studio-list" aria-label="Uploaded photos">
        {photos.map((photo) => (
          <article key={photo.id} className="studio-item">
            <img src={photo.imageUrl} alt="" />
            <div>
              <input
                value={photo.title}
                onChange={(event) => updatePhoto(photo, "title", event.target.value)}
                aria-label="Photo title"
              />
              <input
                value={photo.category}
                onChange={(event) => updatePhoto(photo, "category", event.target.value)}
                aria-label="Photo category"
                list="topic-options"
              />
              <input
                value={photo.labels}
                onChange={(event) => updatePhoto(photo, "labels", event.target.value)}
                aria-label="Hover labels"
              />
              <textarea
                value={photo.notes}
                onChange={(event) => updatePhoto(photo, "notes", event.target.value)}
                aria-label="Private notes"
              />
              <button type="button" className="danger-button" onClick={() => deletePhoto(photo)}>
                Delete photo
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
