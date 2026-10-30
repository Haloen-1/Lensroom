"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader, { StudioLink } from "./components/site-header";
import { useSiteCopy } from "./components/site-copy-provider";
import PhotoImage from "./components/photo-image";
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
  const { t } = useSiteCopy();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/photos", { cache: "no-store", signal: AbortSignal.timeout(30000) }).then((response) => {
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
  const labelTopics = useMemo(() => topicNames(photos.map((photo) => photo.labels)), [photos]);
  const filteredPhotos = photos.filter((photo) =>
    (!activeCategory || hasTopic(photo.category, activeCategory)) &&
    (!activeTopic || hasTopic(photo.labels, activeTopic)));
  const heading = [...new Set([activeTopic, activeCategory].filter(Boolean))].join(" / ") || t("Overview");

  return (
    <main className="site-shell">
      <SiteHeader active="gallery" />
      <section className="intro" aria-labelledby="gallery-title">
        <p className="eyebrow">{t("Photographs")}</p>
        <h1 id="gallery-title">{heading}</h1>
      </section>

      <div className="gallery-toolbar">
        <p className="gallery-count" role="status">
          {loading ? t("Loading photographs") : failed ? t("Gallery unavailable") :
            `${filteredPhotos.length} ${filteredPhotos.length === 1 ? t("photograph") : t("photographs")}`}
        </p>
        <div className="gallery-filters">
        <TopicMenu label="Topic" value={activeTopic} onChange={setActiveTopic} disabled={loading || failed}
          options={[
            { value: "", label: t("Overview"), count: photos.filter((photo) => !activeCategory || hasTopic(photo.category, activeCategory)).length },
            ...labelTopics.map((label) => ({ value: label, label, count: photos.filter((photo) => hasTopic(photo.labels, label) && (!activeCategory || hasTopic(photo.category, activeCategory))).length })),
          ]} />
        <TopicMenu label="Techniques" value={activeCategory} onChange={setActiveCategory} disabled={loading || failed}
          options={[
            { value: "", label: t("Overview"), count: photos.filter((photo) => !activeTopic || hasTopic(photo.labels, activeTopic)).length },
            ...categories.map((category) => ({ value: category, label: category, count: photos.filter((photo) => hasTopic(photo.category, category) && (!activeTopic || hasTopic(photo.labels, activeTopic))).length })),
          ]}
        />
        </div>
      </div>

      {loading ? (
        <div className="gallery-loading" aria-hidden="true">
          <div /><div /><div />
        </div>
      ) : failed ? (
        <div className="empty-state" role="alert">
          <h2>{t("Photographs couldn't load.")}</h2>
          <button className="secondary-button" onClick={() => {
            setLoading(true);
            setFailed(false);
            setAttempt((value) => value + 1);
          }}>{t("Try again")}</button>
        </div>
      ) : filteredPhotos.length ? (
        <section className="photo-grid" key={`${activeTopic}:${activeCategory}`} aria-label={`${heading} gallery`}>
          {filteredPhotos.map((photo, index) => (
            <article
              className="photo-card"
              key={photo.id}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              tabIndex={0}
              aria-label={`${photo.title}, ${photo.category}${photo.labels ? `, ${photo.labels}` : ""}`}
              onContextMenu={(event) => event.preventDefault()}
            >
              <PhotoImage src={photo.imageUrl} alt={photo.title} eager={index === 0} />
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
          <h2>{(activeCategory || activeTopic) ? t("No photographs in this topic yet.") : t("No photographs yet.")}</h2>
          {(activeCategory || activeTopic) && <button className="secondary-button" onClick={() => { setActiveCategory(""); setActiveTopic(""); }}>{t("View all photographs")}</button>}
        </div>
      )}
      <footer className="site-footer"><span>{t("Lensroom")}</span><StudioLink /></footer>
    </main>
  );
}
