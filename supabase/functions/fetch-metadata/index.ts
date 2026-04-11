import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return Response.json({ title: null, imageUrl: null }, { headers: CORS_HEADERS });
    }

    const html = await res.text();

    // og:title or <title>
    const ogTitleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
    );
    const title = ogTitleMatch?.[1]?.trim()
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
      ?? null;

    // og:image
    const ogImageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
    const imageUrl = ogImageMatch?.[1]?.trim() ?? null;

    return Response.json({ title, imageUrl }, { headers: CORS_HEADERS });
  } catch {
    return Response.json({ title: null, imageUrl: null }, { headers: CORS_HEADERS });
  }
});
