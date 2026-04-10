import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_CHAT_IDS = Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Helpers ---

function getAllowedChatIds(): number[] {
  if (!ALLOWED_CHAT_IDS.trim()) return [];
  return ALLOWED_CHAT_IDS.split(",").map((id) => Number(id.trim())).filter(Boolean);
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"'`,)}\]]+/gi;
  return text.match(urlRegex) ?? [];
}

function inferSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]?.replace(/[-_]/g, " ") || "Web";
  } catch {
    return "Web";
  }
}

const VALID_CATEGORIES = [
  "Articles",
  "Tools",
  "Docs",
  "Inspiration",
  "Assets",
  "Courses",
  "Skill",
  "Other",
];

function parseMessage(text: string): {
  urls: string[];
  category: string;
  notes: string;
} {
  const urls = extractUrls(text);

  // Extract #Category tag
  const categoryMatch = text.match(/#(\w+)/);
  let category = "Other";
  if (categoryMatch) {
    const matched = categoryMatch[1];
    const found = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === matched.toLowerCase()
    );
    if (found) category = found;
  }

  // Notes = everything that's not a URL or #tag, trimmed
  let notes = text;
  for (const url of urls) {
    notes = notes.replace(url, "");
  }
  notes = notes.replace(/#\w+/g, "").trim();

  return { urls, category, notes };
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try og:title first, then <title>
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
    );
    if (ogMatch) return ogMatch[1].trim();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return titleMatch[1].trim();

    return null;
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

// --- Main Handler ---

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    const message = update.message;

    if (!message?.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId: number = message.chat.id;

    // Authorization check
    const allowed = getAllowedChatIds();
    if (allowed.length > 0 && !allowed.includes(chatId)) {
      await sendTelegramMessage(chatId, "You are not authorized to use this bot.");
      return new Response("OK", { status: 200 });
    }

    const text: string = message.text;

    // Handle /start command
    if (text.startsWith("/start")) {
      await sendTelegramMessage(
        chatId,
        "Welcome! Send me a link and I'll save it to your resource library.\n\n" +
          "<b>Format:</b>\n" +
          "<code>https://example.com</code>\n" +
          "<code>https://example.com #Tools Great dev tool</code>\n\n" +
          `<b>Categories:</b> ${VALID_CATEGORIES.join(", ")}\n\n` +
          `Your chat ID: <code>${chatId}</code>`
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /id command — useful for getting chat ID during setup
    if (text.startsWith("/id")) {
      await sendTelegramMessage(chatId, `Your chat ID: <code>${chatId}</code>`);
      return new Response("OK", { status: 200 });
    }

    const { urls, category, notes } = parseMessage(text);

    if (urls.length === 0) {
      await sendTelegramMessage(
        chatId,
        "No link found. Send a message with a URL to save it."
      );
      return new Response("OK", { status: 200 });
    }

    const saved: { url: string; title: string }[] = [];

    for (const url of urls) {
      const source = inferSource(url);
      const pageTitle = await fetchPageTitle(url);
      const title = pageTitle || notes || source;

      const { error } = await supabase.from("resources").insert({
        title,
        url,
        category,
        source,
        notes,
        saved_at: new Date().toISOString(),
      });

      if (error) {
        await sendTelegramMessage(chatId, `Failed to save ${escapeHtml(url)}: ${escapeHtml(error.message)}`);
      } else {
        saved.push({ url, title });
      }
    }

    if (saved.length > 0) {
      const label = saved.length === 1 ? "Saved" : `Saved ${saved.length} links`;
      const detail = saved
        .map((s) => `- <b>${escapeHtml(s.title)}</b>\n  ${escapeHtml(s.url)}`)
        .join("\n");
      await sendTelegramMessage(
        chatId,
        `${label} under <b>${escapeHtml(category)}</b>\n${detail}`
      );
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
