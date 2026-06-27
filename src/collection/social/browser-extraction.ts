import type { BrowserCollectionMethod, BrowserObservation, SocialStreamType } from "../../types.js";

export type VisibleSocialExtractionInput = {
  platform: BrowserObservation["platform"];
  streamType: SocialStreamType;
  sourceId: string;
  collectionMethod: BrowserCollectionMethod;
  limit?: number;
};

function normalizeLimit(limit: number | undefined): number {
  return Number.isFinite(limit) && limit && limit > 0 ? Math.floor(limit) : 8;
}

function jsString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;
}

export function buildVisibleSocialExtractionScript(input: VisibleSocialExtractionInput): string {
  const limit = normalizeLimit(input.limit);
  const platform = jsString(input.platform);
  const streamType = jsString(input.streamType);
  const sourceId = jsString(input.sourceId);
  const collectionMethod = jsString(input.collectionMethod);

  return `(() => {
  try {
    const limit = ${limit};
    const platform = ${platform};
    const streamType = ${streamType};
    const sourceId = ${sourceId};
    const collectionMethod = ${collectionMethod};
    const textOf = (element) => (element && (element.getAttribute && (element.getAttribute('title') || element.getAttribute('aria-label')) || element.innerText || element.textContent) || '').replace(/\\s+/g, ' ').trim();
    const isVisible = (element) => {
      try {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
      } catch (_) {
        return false;
      }
    };
    const scoreTitle = (title) => {
      if (!title) return -999;
      let score = Math.min(title.length, 120);
      if (title.length > 160) score -= 220;
      if (title.length > 90) score -= 60;
      if (/^\\d+(\\.\\d+)?\\s+\\d+/.test(title) || /^\\d{1,3}:\\d{2}/.test(title) || /^\\d+(\\.\\d+)?\\s+\\d+\\s+\\d{1,2}:\\d{2}/.test(title)) score -= 80;
      if (/\\d{1,2}:\\d{2}$/.test(title) && title.length < 24) score -= 80;
      if (/^[\\d\\s:.,\\u4e07]+$/.test(title)) score -= 100;
      return score;
    };
    const bestTitle = (anchor) => {
      const selector = 'p[title], [class*=title], [class*=name], [class*=tit]';
      const candidates = [textOf(anchor)];
      let node = anchor;
      for (let depth = 0; node && node !== document.body && depth < 4; depth += 1, node = node.parentElement) {
        const linkCount = node.querySelectorAll ? node.querySelectorAll('a[href]').length : 0;
        if (linkCount > 2) break;
        const scoped = node.querySelectorAll ? Array.from(node.querySelectorAll(selector)).slice(0, 8) : [];
        for (const candidate of scoped) {
          if (isVisible(candidate)) candidates.push(textOf(candidate));
        }
      }
      return candidates.filter(Boolean).sort((a, b) => scoreTitle(b) - scoreTitle(a))[0] || '';
    };
    const unavailableText = document.body && document.body.innerText || '';
    const hardBoundaryMatch = unavailableText.match(/(\\u9a8c\\u8bc1\\u7801|\\u5b89\\u5168\\u9a8c\\u8bc1|captcha|paywall)/i);
    const byUrl = new Map();
    Array.from(document.querySelectorAll('a[href]')).filter(isVisible).forEach((anchor) => {
      let url = '';
      try {
        url = new URL(anchor.getAttribute('href'), location.href).href;
      } catch (_) {
        return;
      }
      if (!/^https?:\\/\\//.test(url) || (platform === 'bilibili' && !/bilibili\\.com\\/video\\//.test(url))) return;
      const key = url.split('?')[0];
      const title = bestTitle(anchor);
      const previous = byUrl.get(key);
      if (!previous || scoreTitle(title) > scoreTitle(previous.title)) byUrl.set(key, { title, url: key });
    });
    const items = Array.from(byUrl.values()).filter((item) => item.title && scoreTitle(item.title) > -50).slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));
    const loginBoundaryMatch = items.length ? null : unavailableText.match(/(\\u8bf7\\u5148\\u767b\\u5f55|\\u767b\\u5f55\\u540e|login)/i);
    const unavailableMatch = hardBoundaryMatch || loginBoundaryMatch;
    return JSON.stringify({
      sourceId,
      platform,
      streamType,
      collectionMethod,
      pageUrl: location.href,
      status: unavailableMatch ? 'unavailable' : items.length ? 'ok' : 'empty',
      capturedAt: new Date().toISOString(),
      message: unavailableMatch ? 'Page displayed an access boundary: ' + unavailableMatch[0] : undefined,
      items: unavailableMatch ? [] : items
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      sourceId: ${sourceId},
      platform: ${platform},
      streamType: ${streamType},
      collectionMethod: ${collectionMethod},
      pageUrl: location.href,
      status: 'error',
      capturedAt: new Date().toISOString(),
      message: String(error && error.message || error),
      items: []
    }, null, 2);
  }
})()`;
}
