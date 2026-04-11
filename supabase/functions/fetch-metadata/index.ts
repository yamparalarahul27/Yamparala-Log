import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMPTY_META = {
  title: null,
  imageUrl: null,
  description: null,
  siteName: null,
  contentType: null,
  tags: null,
  author: null,
  publishedAt: null,
  language: null,
  readingTimeMinutes: null,
};

function extractMeta(name: string, html: string): string | null {
  // property="og:X" content="..."
  const ogProp = html.match(
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i")
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, "i")
  );
  if (ogProp?.[1]) return ogProp[1].trim();

  // name="X" content="..."
  const nameMeta = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i")
  );
  return nameMeta?.[1]?.trim() ?? null;
}

function extractAllMetaByProperty(property: string, html: string): string[] {
  const results: string[] = [];
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']` +
    `|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "gi"
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    const val = (m[1] ?? m[2])?.trim();
    if (val) results.push(val);
  }
  return results;
}

function inferContentType(url: string, ogType: string | null): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.toLowerCase();

    if (host === "github.com" && path.split("/").filter(Boolean).length >= 2) return "repository";
    if (host === "youtube.com" || host === "youtu.be") return "video";
    if (host === "vimeo.com") return "video";
    if (host === "x.com" || host === "twitter.com") return "tweet";
    if (host === "open.spotify.com" && path.includes("/episode")) return "podcast";
    if (host === "medium.com" || host === "dev.to" || host === "hashnode.dev") return "article";
    if (host.startsWith("docs.") || path.includes("/docs")) return "documentation";
    if (path.includes("/blog")) return "article";
  } catch {
    // ignore
  }

  if (ogType) {
    const t = ogType.toLowerCase();
    if (t === "article" || t === "blog") return "article";
    if (t.startsWith("video")) return "video";
    if (t === "music" || t.startsWith("music.")) return "audio";
    if (t === "profile") return "profile";
  }

  return null;
}

function estimateReadingTime(html: string): number | null {
  // Strip scripts, styles, and HTML tags to get visible text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 50) return null; // too short to estimate
  const minutes = Math.ceil(wordCount / 200);
  return minutes > 120 ? null : minutes; // cap at 2 hours, likely a bad estimate
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return Response.json({ error: "Missing url" }, { status: 400, headers: CORS_HEADERS });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return Response.json(EMPTY_META, { headers: CORS_HEADERS });
    }

    const html = await res.text();

    // Title: og:title -> <title>
    const title = extractMeta("title", html)
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
      ?? null;

    // Image: og:image
    const imageUrl = extractMeta("image", html);

    // Description: og:description -> <meta name="description">
    const description = extractMeta("description", html);

    // Site name: og:site_name
    const siteName = extractMeta("site_name", html);

    // Content type: inferred from URL + og:type
    const ogType = extractMeta("type", html);
    const contentType = inferContentType(url, ogType);

    // Tags: <meta name="keywords"> + article:tag
    const tags: string[] = [];
    const keywords = extractMeta("keywords", html);
    if (keywords) {
      tags.push(...keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean));
    }
    const articleTags = extractAllMetaByProperty("article:tag", html);
    for (const t of articleTags) {
      const lower = t.toLowerCase();
      if (!tags.includes(lower)) tags.push(lower);
    }

    // Author: <meta name="author"> -> article:author -> twitter:creator
    const author = extractMeta("author", html)
      ?? extractMeta("article:author", html)
      ?? extractMeta("twitter:creator", html);

    // Published date: article:published_time -> JSON-LD datePublished
    let publishedAt: string | null = extractMeta("article:published_time", html);
    if (!publishedAt) {
      const ldMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
      publishedAt = ldMatch?.[1]?.trim() ?? null;
    }
    // Validate it parses as a date
    if (publishedAt && isNaN(new Date(publishedAt).getTime())) {
      publishedAt = null;
    }

    // Language: <html lang="..."> -> og:locale
    const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
    let language = langMatch?.[1]?.trim() ?? extractMeta("locale", html);
    if (language) {
      language = language.split(/[_-]/)[0].toLowerCase(); // en_US -> en
    }

    // Reading time
    const readingTimeMinutes = estimateReadingTime(html);

    return Response.json(
      { title, imageUrl, description, siteName, contentType, tags: tags.length > 0 ? tags : null, author, publishedAt, language, readingTimeMinutes },
      { headers: CORS_HEADERS },
    );
  } catch {
    return Response.json(EMPTY_META, { headers: CORS_HEADERS });
  }
});
