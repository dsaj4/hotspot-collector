export function parseIntegerEnv(value: string | undefined, fallback: number, options: { min?: number; max?: number } = {}): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(parsed, min), max);
}

export function parseCsvEnv(value: string | undefined, fallback = ""): string[] {
  return (value ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseUsernameCsvEnv(value: string | undefined): string[] {
  return parseCsvEnv(value).map((username) => username.replace(/^@/, ""));
}
