export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[。！？.!?])\s+|[;；]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function truncateAtSentence(text: string, maxChars: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxChars) return normalized;
  const sentences = splitSentences(normalized);
  const selected: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    const nextLength = length + (selected.length ? 1 : 0) + sentence.length;
    if (nextLength > maxChars) break;
    selected.push(sentence);
    length = nextLength;
  }
  if (selected.length) return selected.join(" ");
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function sourceExcerpt(text: string, maxChars: number): string {
  return truncateAtSentence(text, maxChars).replace(/^#+\s*/g, "").trim();
}
