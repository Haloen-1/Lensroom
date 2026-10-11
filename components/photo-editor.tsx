"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { commaValues, photoTopics } from "../photo-metadata";

export type EditablePhoto = {
  id: number;
  title: string;
  category: string;
  labels: string;
  notes: string;
  imageUrl: string;
  createdAt: string;
};

function fields(photo: EditablePhoto) {
  return { title: photo.title, category: photo.category, labels: photo.labels, notes: photo.notes };
}

export default function PhotoEditor({ photo, onSaved, onDelete }: {
  photo: EditablePhoto;
  onSaved: (photo: EditablePhoto) => void;
  onDelete: (photo: EditablePhoto) => void;
}) {
  const [source, setSource] = useState(photo);
  const [draft, setDraft] = useState(fields(photo));
  const [saved, setSaved] = useState(fields(photo));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Refresh clean editors after topic changes without discarding unsaved work.
  if (photo !== source) {
    setSource(photo);
    if (!dirty && !saving) {
      setDraft(fields(photo));
      setSaved(fields(photo));
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
    setFailed(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || savingRef.current) return;
    const payload = {
      ...draft,
      title: draft.title.trim() || "Untitled",
      category: photoTopics(draft.category).join(", "),
      labels: commaValues(draft.labels).join(", "),
    };
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    setMessage("Saving...");
    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || "Could not save changes. Please try again.");
      setDraft(payload);
      setSaved(payload);
      setMessage("Saved");
      onSaved({ ...photo, ...payload });
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Could not save changes. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <article className="studio-item" aria-label={`Edit ${photo.title}`}>
      <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
      <form className="photo-fields" onSubmit={save}>
        <label className="field"><span>Title</span>
          <input value={draft.title} disabled={saving} onChange={(event) => edit("title", event.target.value)} aria-label="Photo title" />
        </label>
        <label className="field"><span>Topics (comma-separated)</span>
          <input value={draft.category} disabled={saving} onChange={(event) => edit("category", event.target.value)} aria-label="Photo topics" placeholder="Color, Rule of Thirds" />
        </label>
        <label className="field field-wide"><span>Labels (comma-separated)</span>
          <input value={draft.labels} disabled={saving} onChange={(event) => edit("labels", event.target.value)} aria-label="Photo labels" />
        </label>
        <label className="field field-wide"><span>Notes</span>
          <textarea value={draft.notes} disabled={saving} onChange={(event) => edit("notes", event.target.value)} aria-label="Photo notes" />
        </label>
        <div className="form-actions field-wide">
          <p className="form-status" role={failed ? "alert" : "status"}>{message || (dirty ? "Unsaved changes" : "")}</p>
          <button type="button" className="danger-button" disabled={saving} onClick={() => onDelete(photo)}>Delete photo</button>
          <button type="submit" disabled={saving || !dirty}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </article>
  );
}
