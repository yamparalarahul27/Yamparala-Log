export function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "x.com" && u.hostname !== "twitter.com") return null;
    const match = u.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function proxyImage(url: string | null, width = 800): string | null {
  if (!url) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=${width}&output=webp&q=75`;
}
