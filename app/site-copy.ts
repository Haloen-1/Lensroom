export const textGroups = {
  "Brand and navigation": [
    "Lensroom",
    "Lensroom home",
    "Gallery",
    "Studio",
    "Back to gallery",
    "Main navigation",
    "Color scheme",
    "Paper",
    "Forest",
    "Ink",
    "Rose",
    "Text admin"
  ],
  "Gallery": [
    "Photographs",
    "Overview",
    "Topic",
    "Techniques",
    "Topics",
    "Loading photographs",
    "Gallery unavailable",
    "photograph",
    "photographs",
    "Photographs couldn't load.",
    "Try again",
    "No photographs in this topic yet.",
    "No photographs yet.",
    "View all photographs"
  ],
  "Studio and upload": [
    "Lensroom / Studio",
    "Welcome back.",
    "Passphrase",
    "Studio passphrase",
    "Checking...",
    "Enter Studio",
    "Your collection",
    "Upload",
    "Access",
    "New photograph",
    "Choose photo",
    "No file selected",
    "Title",
    "Untitled",
    "Topics (comma-separated)",
    "Color, Rule of Thirds",
    "Labels (comma-separated)",
    "Travel, architecture, evening",
    "Notes",
    "Uploading...",
    "Save photo",
    "Uploaded photos",
    "Studio sections"
  ],
  "Photo editing": [
    "Photo title",
    "Photo topics",
    "Photo labels",
    "Photo notes",
    "Save changes",
    "Saving...",
    "Saved",
    "Unsaved changes",
    "Delete photo",
    "Could not save changes. Please try again."
  ],
  "Technique editing": [
    "New topics (comma-separated)",
    "Add topics",
    "No topics yet.",
    "Edit topics",
    "Delete",
    "Adding",
    "Topic added",
    "Topic updated",
    "Could not add the topic",
    "Could not update the topic",
    "Topic deleted; other photo topics kept",
    "Could not delete the topic"
  ],
  "Studio access": [
    "Studio access",
    "Current passphrase",
    "New passphrase",
    "Update passphrase",
    "Updating",
    "Passphrase updated",
    "Could not update the passphrase",
    "Checking",
    "That passphrase did not work.",
    "Studio is unavailable. Please try again.",
    "Could not connect. Please try again."
  ],
  "Upload messages": [
    "Uploading",
    "Choose an image file first.",
    "Could not save the photo."
  ],
  "Browser title": [
    "Browser title",
    "Browser description"
  ]
} as const;

export type SiteCopy = Record<string, string>;
export const defaultCopy: SiteCopy = Object.fromEntries(
  Object.values(textGroups).flat().map((text) => [text, text]),
);
const renamedText: SiteCopy = {
  "Topics": "Techniques",
  "Topics (comma-separated)": "Techniques (comma-separated)",
  "Labels (comma-separated)": "Topic (comma-separated)",
  "Notes": "Artist statement",
  "Photo topics": "Photo techniques",
  "Photo labels": "Photo topics",
  "Photo notes": "Artist statement",
  "New topics (comma-separated)": "New techniques (comma-separated)",
  "Add topics": "Add techniques",
  "Edit topics": "Edit techniques",
  "No topics yet.": "No techniques yet.",
  "Topic added": "Technique added",
  "Topic updated": "Technique updated",
  "Topic deleted; other photo topics kept": "Technique deleted; other techniques kept",
  "Paper": "Linen",
  "Forest": "Sage",
  "Ink": "Graphite",
  "Rose": "Mist",
};
Object.assign(defaultCopy, renamedText);

defaultCopy["Browser title"] = "Lensroom";
defaultCopy["Browser description"] = "An image-first portfolio with topic galleries and private photo labeling.";

export function validCopy(value: unknown): value is SiteCopy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, text]) =>
    Object.hasOwn(defaultCopy, key) && typeof text === "string" && text.trim().length > 0 && text.length <= 500,
  );
}

export function mergeCopy(value: unknown): SiteCopy {
  const overrides = validCopy(value) ? { ...value } : {};
  // Upgrade old default wording, while retaining deliberate text customization.
  for (const key of Object.keys(renamedText)) if (overrides[key] === key) delete overrides[key];
  return { ...defaultCopy, ...overrides };
}
