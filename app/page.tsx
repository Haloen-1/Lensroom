"use client";

import { useEffect, useMemo, useState } from "react";

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

const fallbackPhotos: Photo[] = [
  {
    id: -1,
    title: "Kitchen Light",
    category: "Food",
    labels: "sample, breakfast, window light",
    notes: "Replace this with your own upload in the studio.",
    imageUrl:
      "https://images.unsplash.com/photo-1514986888952-8cd320577b68?auto=format&fit=crop&w=1200&q=80",
    createdAt: "2026-07-18",
  },
  {
    id: -2,
    title: "Quiet Table",
    category: "Interiors",
    labels: "sample, still life, natural texture",
    notes: "",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    createdAt: "2026-07-18",
  },
  {
    id: -3,
    title: "Road North",
    category: "Travel",
    labels: "sample, landscape, afternoon",
    notes: "",
    imageUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
    createdAt: "2026-07-18",
  },
];

const allPhotosCategory = "Overview";

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeCategory, setActiveCategory] = useState(allPhotosCategory);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState("paper");

  useEffect(() => {
    const savedTheme = localStorage.getItem("lensroom-theme") || "paper";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/photos").then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch("/api/topics").then((response) => (response.ok ? response.json() : { topics: [] })),
    ])
      .then(([photoData, topicData]: [{ photos: Photo[] }, { topics: Topic[] }]) => {
        setPhotos(photoData.photos);
        setTopics(topicData.topics ?? []);
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, []);

  const visiblePhotos = photos.length ? photos : fallbackPhotos;
  const categories = useMemo(
    () => [
      allPhotosCategory,
      ...Array.from(
        new Set([
          ...topics.map((topic) => topic.name),
          ...visiblePhotos.map((photo) => photo.category),
        ]),
      ).sort(),
    ],
    [topics, visiblePhotos],
  );
  const filteredPhotos =
    activeCategory === allPhotosCategory
      ? visiblePhotos
      : visiblePhotos.filter((photo) => photo.category === activeCategory);
  const photoCountLabel = `${filteredPhotos.length} ${
    filteredPhotos.length === 1 ? "photograph" : "photographs"
  }`;

  function chooseCategory(category: string) {
    setActiveCategory(category);
    setIsMenuOpen(false);
  }

  function chooseTheme(nextTheme: string) {
    setTheme(nextTheme);
    localStorage.setItem("lensroom-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <main className="site-shell">
      <header className="masthead">
        <a className="brand" href="/">
          Lensroom
        </a>
        <nav className="navline" aria-label="Gallery categories">
          <div className="theme-switcher" aria-label="Color scheme">
            {["paper", "sage", "ink", "silver"].map((item) => (
              <button
                key={item}
                type="button"
                className={`theme-swatch theme-${item}`}
                aria-label={`${item} color scheme`}
                aria-pressed={theme === item}
                onClick={() => chooseTheme(item)}
              />
            ))}
          </div>
          <div
            className="category-menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="category-trigger"
              aria-haspopup="listbox"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <span>{activeCategory}</span>
              <span aria-hidden="true" className="category-chevron">
                Down
              </span>
            </button>
            <div className={`category-panel ${isMenuOpen ? "is-open" : ""}`}>
              <div className="category-options" role="listbox" aria-label="Choose a gallery category">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="option"
                    aria-selected={category === activeCategory}
                    tabIndex={isMenuOpen ? 0 : -1}
                    onClick={() => chooseCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <a href="/studio" className="studio-link" aria-label="Open studio manager">
            Studio
          </a>
        </nav>
      </header>

      <section className="intro" aria-label="Portfolio introduction">
        <h1>{activeCategory}</h1>
      </section>

      <section className="gallery-meta" aria-live="polite">
        <span>{loading ? "Loading archive" : activeCategory}</span>
        <span>{photoCountLabel}</span>
      </section>

      <section className="photo-grid" aria-label={`${activeCategory} gallery`}>
        {filteredPhotos.map((photo, index) => (
          <article
            className="photo-card"
            key={photo.id}
            onContextMenu={(event) => event.preventDefault()}
          >
            <img
              src={photo.imageUrl}
              alt={photo.title}
              loading={index < 4 ? "eager" : "lazy"}
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
            />
            <div className="hover-label">
              <strong>{photo.title}</strong>
              <span>{photo.category}</span>
              {photo.labels ? <em>{photo.labels}</em> : null}
            </div>
          </article>
        ))}
      </section>

      {!filteredPhotos.length && (
        <p className="empty-state">No photographs have been assigned to this topic yet.</p>
      )}
    </main>
  );
}
