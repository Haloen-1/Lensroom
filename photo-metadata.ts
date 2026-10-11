export function nameKey(value: string): string {
  return value.trim().normalize("NFKC").toLowerCase();
}

export function commaValues(value: string): string[] {
  const unique = new Map<string, string>();
  for (const part of value.split(",")) {
    const name = part.trim();
    if (name && !unique.has(nameKey(name))) unique.set(nameKey(name), name);
  }
  return [...unique.values()];
}

export function photoTopics(value: string): string[] {
  const names = commaValues(value);
  return names.length ? names : ["Unsorted"];
}

export function hasTopic(value: string, topic: string): boolean {
  return photoTopics(value).some((name) => nameKey(name) === nameKey(topic));
}

export function topicNames(values: string[]): string[] {
  return commaValues(values.join(",")).sort((a, b) => a.localeCompare(b));
}

export function replaceTopic(value: string, previous: string, replacement: string): string {
  const previousKeys = new Set(commaValues(previous).map(nameKey));
  return photoTopics(photoTopics(value).flatMap((name) =>
    previousKeys.has(nameKey(name)) ? commaValues(replacement) : [name],
  ).join(", ")).join(", ");
}
