"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader, { StudioLink } from "./components/site-header";
import TopicMenu from "./components/topic-menu";
import { commaValues, hasTopic, photoTopics, topicNames } from "./photo-metadata";

type Photo = {
  id: number;
  title: string;
  category: string;
  labels: string;
  imageUrl: string;
};

type Topic = { id: number; name: string; sortOrder: number };

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/photos").then((response) => {
        if (!response.ok) throw new Error("Could not load photographs");
        return response.json();
      }),
      fetch("/api/topics")
        .then((response) => response.ok ? response.json() : { topics: [] })
        .catch(() => ({ topics: [] })),
    ])
      .then(([photoData, topicData]: [{ photos: Photo[] }, { topics: Topic[] }]) => {
        if (cancelled) return;
        setPhotos(photoData.photos ?? []);
        setTopics(topicData.topics ?? []);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const categories = useMemo(
    () => topicNames([
      ...topics.map((topic) => topic.name),
      ...photos.flatMap((photo) => photoTopics(photo.category)),
    ]),
    [topics, photos],
  );
  const filteredPhotos = activeCategory
    ? photos.filter((photo) => hasTopic(photo.category, activeCategory))
    : photos;
  const heading = activeCategory || "Overview";

  return (
    <main className="site-shell">
      <SiteHeader active="gallery" />
      <section className="intro" aria-labelledby="gallery-title">
        <p className="eyebrow">Photographs</p>
        <h1 id="gallery-title">{heading}</h1>
      </section>

      <div className="gallery-toolbar">
        <p className="gallery-count" role="status">
          {loading ? "Loading photographs" : failed ? "Gallery unavailable" :
            `${filteredPhotos.length} ${filteredPhotos.length === 1 ? "photograph" : "photographs"}`}
        </p>
        <TopicMenu value={activeCategory} onChange={setActiveCategory} disabled={loading || failed}
          options={[
            { value: "", label: "Overview", count: photos.length },
            ...categories.map((category) => ({ value: category, label: category, count: photos.filter((photo) => hasTopic(photo.category, category)).length })),
          ]}
        />
      </div>

      {loading ? (
        <div className="gallery-loading" aria-hidden="true">
          <div /><div /><div />
        </div>
      ) : failed ? (
        <div className="empty-state" role="alert">
          <h2>Photographs couldn&apos;t load.</h2>
          <button className="secondary-button" onClick={() => {
            setLoading(true);
            setFailed(false);
            setAttempt((value) => value + 1);
          }}>Try again</button>
        </div>
      ) : filteredPhotos.length ? (
        <section className="photo-grid" aria-label={`${heading} gallery`}>
          {filteredPhotos.map((photo, index) => (
            <article
              className="photo-card"
              key={photo.id}
              tabIndex={0}
              aria-label={`${photo.title}, ${photo.category}${photo.labels ? `, ${photo.labels}` : ""}`}
              onContextMenu={(event) => event.preventDefault()}
            >
              <img
                src={photo.imageUrl}
                alt={photo.title}
                loading={index < 4 ? "eager" : "lazy"}
                draggable={false}
              />
              <div className="hover-label">
                <strong>{photo.title}</strong>
                <span>{photoTopics(photo.category).join(", ")}</span>
                {commaValues(photo.labels).length ? <em>{commaValues(photo.labels).join(", ")}</em> : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <h2>{activeCategory ? "No photographs in this topic yet." : "No photographs yet."}</h2>
          {activeCategory && <button className="secondary-button" onClick={() => setActiveCategory("")}>View all photographs</button>}
        </div>
      )}
      <footer className="site-footer"><span>Lensroom</span><StudioLink /></footer>
    </main>
  );
}
