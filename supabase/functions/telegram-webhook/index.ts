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

interface PageMeta {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
  siteName: string | null;
  contentType: string | null;
  tags: string[] | null;
  author: string | null;
  publishedAt: string | null;
  language: string | null;
  readingTimeMinutes: number | null;
}

const EMPTY_META: PageMeta = {
  title: null, imageUrl: null, description: null, siteName: null,
  contentType: null, tags: null, author: null, publishedAt: null,
  language: null, readingTimeMinutes: null,
};

async function fetchPageMeta(url: string): Promise<PageMeta> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return EMPTY_META;
    return await res.json();
  } catch {
    return EMPTY_META;
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
          "<b>Add a task:</b> Send a link, then send a text within 1 minute — it becomes a task.\n\n" +
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

    // No URL — check if this is a follow-up comment to the last saved link (within 1 min)
    if (urls.length === 0) {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recent } = await supabase
        .from("resources")
        .select("id, title")
        .gte("saved_at", oneMinuteAgo)
        .order("saved_at", { ascending: false })
        .limit(1)
        .single();

      if (recent) {
        const { error } = await supabase
          .from("resources")
          .update({ notes: text.trim() })
          .eq("id", recent.id);

        if (error) {
          await sendTelegramMessage(chatId, `Could not add task: ${escapeHtml(error.message)}`);
        } else {
          await sendTelegramMessage(
            chatId,
            `Task added to <b>${escapeHtml(recent.title)}</b>:\n${escapeHtml(text.trim())}`
          );
        }
      } else {
        await sendTelegramMessage(
          chatId,
          "No link found and no recent save to attach this to.\nSend a URL first, then follow up with your task."
        );
      }
      return new Response("OK", { status: 200 });
    }

    const saved: { url: string; title: string }[] = [];

    for (const url of urls) {
      const source = inferSource(url);
      const meta = await fetchPageMeta(url);
      const title = meta.title || notes || source;

      const { error } = await supabase.from("resources").insert({
        title,
        url,
        category,
        source,
        notes,
        image_url: meta.imageUrl,
        description: meta.description,
        site_name: meta.siteName,
        content_type: meta.contentType,
        tags: meta.tags ?? [],
        author: meta.author,
        published_at: meta.publishedAt,
        language: meta.language,
        reading_time_minutes: meta.readingTimeMinutes,
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
