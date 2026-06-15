export function nowIso(): string {
  return new Date().toISOString();
}

export function dateFolder(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function safeTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
