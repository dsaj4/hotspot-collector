import { createHash } from "node:crypto";

export function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

export function sourceSafeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-");
}
