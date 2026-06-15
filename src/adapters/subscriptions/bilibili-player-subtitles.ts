import { cdpEvaluate, findCdpPage } from "../../core/cdp.js";
import type { TranscriptSegment } from "../../types.js";

type SubtitleTrack = {
  lan: string;
  lanDoc: string;
  subtitleUrl: string;
  type: number;
  aiType: number;
  aiStatus: number;
};

type SubtitleBody = {
  body?: Array<{ from?: number; to?: number; content?: string }>;
};

type WireValue = number | Uint8Array;

function readVarint(bytes: Uint8Array, start: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < bytes.length) {
    const byte = bytes[offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, next: offset };
    shift += 7;
  }
  throw new Error("Invalid protobuf varint.");
}

function decodeFields(bytes: Uint8Array): Map<number, WireValue[]> {
  const fields = new Map<number, WireValue[]>();
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.next;
    const field = tag.value >>> 3;
    const wire = tag.value & 7;
    let value: WireValue;
    if (wire === 0) {
      const parsed = readVarint(bytes, offset);
      value = parsed.value;
      offset = parsed.next;
    } else if (wire === 1) {
      value = bytes.slice(offset, offset + 8);
      offset += 8;
    } else if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.next;
      value = bytes.slice(offset, offset + length.value);
      offset += length.value;
    } else if (wire === 5) {
      value = bytes.slice(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wire}`);
    }
    const values = fields.get(field) ?? [];
    values.push(value);
    fields.set(field, values);
  }
  return fields;
}

function bytesValue(fields: Map<number, WireValue[]>, field: number, index = 0): Uint8Array | undefined {
  const value = fields.get(field)?.[index];
  return value instanceof Uint8Array ? value : undefined;
}

function numberValue(fields: Map<number, WireValue[]>, field: number): number {
  const value = fields.get(field)?.[0];
  return typeof value === "number" ? value : 0;
}

function stringValue(fields: Map<number, WireValue[]>, field: number): string {
  const value = bytesValue(fields, field);
  return value ? new TextDecoder().decode(value) : "";
}

export function decodeSubtitleTracks(bytes: Uint8Array): SubtitleTrack[] {
  const reply = decodeFields(bytes);
  const videoBytes = bytesValue(reply, 1);
  if (!videoBytes) return [];
  const video = decodeFields(videoBytes);
  return (video.get(3) ?? []).flatMap((value) => {
    if (!(value instanceof Uint8Array)) return [];
    const item = decodeFields(value);
    return [{
      lan: stringValue(item, 3),
      lanDoc: stringValue(item, 4),
      subtitleUrl: stringValue(item, 5),
      type: numberValue(item, 7),
      aiType: numberValue(item, 9),
      aiStatus: numberValue(item, 10)
    }];
  });
}

const xorPairs = [
  ['nP](wOFRvU.+<fjS{jn-!$D|Dz&",zT`', '=CFxYRn{.y|uVyO$uh&sikph?N.ilF/`'],
  ['Bn"q~|albg@]Go~ACgyDvKnd+)_D}^&J?', "Cu~L!xs~f^&r@'vh=q]q{eeng*sEg^kp#J"]
] as const;

function xorDecode(text: string, key: string): string {
  return [...text].map((character, index) => String.fromCharCode(character.charCodeAt(0) ^ key.charCodeAt(index % key.length))).join("");
}

export function decodeSubtitleUrl(url: string): string {
  const [base, query = ""] = url.split("?");
  const match = base.match(/\/\/subtitle\.bilibili\.com\/(.+)$/);
  if (!match) return url.startsWith("//") ? `https:${url}` : url;
  let encodedPath: string;
  try {
    encodedPath = decodeURIComponent(match[1]);
  } catch {
    return "";
  }
  for (const [prefix, key] of xorPairs) {
    const decoded = xorDecode(encodedPath, `${key}bilibili`);
    if (decoded.startsWith(prefix)) {
      return `https://aisubtitle.hdslb.com${decoded.slice(prefix.length)}${query ? `?${query}` : ""}`;
    }
  }
  return "";
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${remaining.toFixed(3).padStart(6, "0")}`;
}

export function normalizeSubtitleBody(payload: SubtitleBody): { text: string; segments: TranscriptSegment[] } {
  const segments = (payload.body ?? []).flatMap((row) => {
    const text = row.content?.trim();
    if (!text || typeof row.from !== "number" || typeof row.to !== "number") return [];
    return [{ start: formatTime(row.from), end: formatTime(row.to), text }];
  });
  return { segments, text: segments.map((segment) => segment.text).join("\n") };
}

function arrayBufferExpression(videoId: string): string {
  return `(async()=>{const v=await fetch('https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(videoId)}',{credentials:'include'}).then(r=>r.json());const aid=v.data?.aid,cid=v.data?.pages?.[0]?.cid;if(!aid||!cid)return {error:'missing aid/cid'};const u=new URL('https://api.bilibili.com/x/v2/subtitle/web/view');u.search=new URLSearchParams({oid:String(cid),pid:String(aid),context_ext:JSON.stringify({video_type:1}),type:'1',cur_production_type:'0',preferred_language:'ai-zh'});const r=await fetch(u,{credentials:'include'});const b=new Uint8Array(await r.arrayBuffer());let binary='';for(const value of b)binary+=String.fromCharCode(value);return {aid,cid,status:r.status,base64:btoa(binary)};})()`;
}

export async function collectBilibiliPlayerSubtitle(
  videoId: string,
  port = Number.parseInt(process.env.BILIBILI_CDP_PORT ?? "9223", 10)
): Promise<{
  track: SubtitleTrack;
  payload: SubtitleBody;
  text: string;
  segments: TranscriptSegment[];
} | null> {
  const webSocketUrl = await findCdpPage(port, "bilibili.com");
  if (!webSocketUrl) return null;
  const response = await cdpEvaluate<{ error?: string; base64?: string }>(webSocketUrl, arrayBufferExpression(videoId));
  if (response.error || !response.base64) return null;
  const tracks = decodeSubtitleTracks(Uint8Array.from(Buffer.from(response.base64, "base64")));
  const track = tracks.find((item) => item.lan === "ai-zh" || item.type === 1);
  if (!track?.subtitleUrl) return null;
  const subtitleUrl = decodeSubtitleUrl(track.subtitleUrl);
  if (!subtitleUrl) return null;
  const subtitleResponse = await fetch(subtitleUrl, {
    headers: {
      Referer: `https://www.bilibili.com/video/${videoId}`,
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!subtitleResponse.ok) {
    throw new Error(`Bilibili subtitle download failed with HTTP ${subtitleResponse.status}.`);
  }
  const payload = await subtitleResponse.json() as SubtitleBody;
  const normalized = normalizeSubtitleBody(payload);
  if (!normalized.text) return null;
  return { track, payload, ...normalized };
}
